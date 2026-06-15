/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { type ContentBlock, getContentBlocks } from "@/lib/content-blocks";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl, toImageAsset } from "@/lib/images";
import { getPersonPositions } from "@/lib/persons";
import { getRelatedEntities, getRelatedResources, resolveDocumentId } from "@/lib/relations";
import { mapSocialMedia } from "@/lib/social-media";
import type { Database, Transaction } from "@/middlewares/db";
import { type SQLWrapper, alias, and, count, eq, exists, inArray, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

interface GetMembersAndPartnersParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getMembersAndPartners(
	db: Database | Transaction,
	params: GetMembersAndPartnersParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.membersAndPartners.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
			},
			columns: {
				id: true,
				metadata: true,
				name: true,
				summary: true,
				status: true,
				type: true,
				sshocMarketplaceActorId: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true },
						},
					},
				},
				image: {
					columns: {
						key: true,
						alt: true,
						caption: true,
					},
					with: {
						license: {
							columns: {
								name: true,
								url: true,
							},
						},
					},
				},
				socialMedia: {
					columns: {
						id: true,
						name: true,
						url: true,
						duration: true,
					},
					with: {
						type: {
							columns: {
								type: true,
							},
						},
					},
				},
			},
			orderBy(t, { desc, sql }) {
				return [desc(sql`"entityVersion"."r" ->> 'updatedAt'`)];
			},
			limit,
			offset,
		}),
		db
			.select({ total: count() })
			.from(schema.membersAndPartners)
			.innerJoin(schema.entityVersions, eq(schema.membersAndPartners.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = await Promise.all(
		items.map(async (item) => {
			const nationalConsortium =
				item.status === "is_member_of" || item.status === "is_observer_of"
					? await getNationalConsortium(db, item.id)
					: null;
			const image = nationalConsortium?.image ?? generateImageUrl(item.image, imageWidth.preview);
			const socialMedia = mapSocialMedia(item.socialMedia);

			return { ...flattenEntityVersion(item), image, socialMedia };
		}),
	);

	return { data, limit, offset, total };
}

//

function mapPersonContributors(
	rows: Array<{
		id: string;
		name: string;
		slug: string;
		imageKey: string | null;
		imageAlt: string | null;
		imageCaption: string | null;
		licenseName: string | null;
		licenseUrl: string | null;
		role: string;
	}>,
	positions: Map<string, Array<{ role: string; name: string; type: string }> | null>,
) {
	return rows.map(({ imageKey, imageAlt, imageCaption, licenseName, licenseUrl, role, ...row }) => {
		return {
			...row,
			position: positions.get(row.id) ?? null,
			role,
			slug: row.slug,
			image: generateImageUrl(
				toImageAsset({
					key: imageKey,
					alt: imageAlt,
					caption: imageCaption,
					licenseName,
					licenseUrl,
				}),
				imageWidth.avatar,
			),
		};
	});
}

function hasContent(block: ContentBlock): boolean {
	switch (block.type) {
		case "rich_text": {
			return hasRichTextContent(block.content);
		}
		case "accordion": {
			return block.items.length > 0;
		}
		case "hero": {
			return (
				block.title.trim().length > 0 ||
				(block.eyebrow?.trim().length ?? 0) > 0 ||
				block.image != null ||
				(block.ctas?.length ?? 0) > 0
			);
		}
		case "data":
		case "embed":
		case "image": {
			return true;
		}
	}
}

function hasRichTextContent(content: unknown): boolean {
	if (typeof content === "string") {
		return content.trim().length > 0;
	}

	if (Array.isArray(content)) {
		return content.some((item) => hasRichTextContent(item));
	}

	if (content != null && typeof content === "object") {
		const value = content as { content?: unknown; text?: unknown };

		if (typeof value.text === "string") {
			return value.text.trim().length > 0;
		}

		return hasRichTextContent(value.content);
	}

	return false;
}

function hasContentBlocks(blocks: Array<ContentBlock> | undefined): blocks is Array<ContentBlock> {
	return blocks?.some((block) => hasContent(block)) === true;
}

type RelationStatus =
	| "is_member_of"
	| "is_observer_of"
	| "is_partner_institution_of"
	| "is_national_coordinating_institution_in"
	| "is_national_representative_institution_in"
	| "is_located_in"
	| "is_national_consortium_of"
	| "is_cooperating_partner_of";

function buildActiveRelationExistsFilter(
	db: Database | Transaction,
	idRef: string | SQLWrapper,
	status: RelationStatus | Array<RelationStatus>,
	relatedType: "eric" | "country",
) {
	const durationContainsNow = sql`
		${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ
	`;

	// Unit↔unit relations are document-level; the related unit is resolved from its document id to
	// any of its versions to check the related type. idRef is a version id of the owning unit.
	const relatedUnitVersion = alias(schema.entityVersions, "exists_related_unit_version");
	const relatedEntity = alias(schema.entities, "exists_related_entity");

	return exists(
		db
			.select({ one: sql<number>`1` })
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitsRelations.status, schema.organisationalUnitStatus.id),
			)
			.innerJoin(
				relatedUnitVersion,
				eq(relatedUnitVersion.entityId, schema.organisationalUnitsRelations.relatedUnitDocumentId),
			)
			.innerJoin(relatedEntity, eq(relatedEntity.id, relatedUnitVersion.entityId))
			.innerJoin(
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, relatedUnitVersion.id),
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					sql`${schema.organisationalUnitsRelations.unitDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${idRef})`,
					Array.isArray(status)
						? inArray(schema.organisationalUnitStatus.status, status)
						: eq(schema.organisationalUnitStatus.status, status),
					eq(schema.organisationalUnitTypes.type, relatedType),
					relatedType === "eric" ? eq(relatedEntity.slug, "dariah-eu") : undefined,
					durationContainsNow,
				),
			),
	);
}

function buildActiveRelationToUnitFilter(
	db: Database | Transaction,
	idRef: string | SQLWrapper,
	status: RelationStatus,
	relatedType: "eric" | "country",
	relatedUnitId: string | SQLWrapper,
) {
	const durationContainsNow = sql`
		${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ
	`;

	// Unit↔unit relations are document-level; idRef and relatedUnitId are version ids resolved to
	// their document ids, and the related unit's type is checked via any of its versions.
	const relatedUnitVersion = alias(schema.entityVersions, "exists_to_unit_related_version");
	const relatedEntity = alias(schema.entities, "exists_to_unit_related_entity");

	return exists(
		db
			.select({ one: sql<number>`1` })
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitsRelations.status, schema.organisationalUnitStatus.id),
			)
			.innerJoin(
				relatedUnitVersion,
				eq(relatedUnitVersion.entityId, schema.organisationalUnitsRelations.relatedUnitDocumentId),
			)
			.innerJoin(relatedEntity, eq(relatedEntity.id, relatedUnitVersion.entityId))
			.innerJoin(
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, relatedUnitVersion.id),
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					sql`${schema.organisationalUnitsRelations.unitDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${idRef})`,
					sql`${schema.organisationalUnitsRelations.relatedUnitDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${relatedUnitId})`,
					eq(schema.organisationalUnitStatus.status, status),
					eq(schema.organisationalUnitTypes.type, relatedType),
					relatedType === "eric" ? eq(relatedEntity.slug, "dariah-eu") : undefined,
					durationContainsNow,
				),
			),
	);
}

async function getInstitutionsByRelation(
	db: Database | Transaction,
	countryId: schema.OrganisationalUnit["id"],
	status: RelationStatus | Array<RelationStatus>,
) {
	const items = (await db.query.organisationalUnits.findMany({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
			},
			type: {
				type: "institution",
			},
			RAW(t) {
				return and(
					buildActiveRelationExistsFilter(db, t.id, status, "eric"),
					buildActiveRelationToUnitFilter(db, t.id, "is_located_in", "country", countryId),
				)!;
			},
		},
		columns: {
			name: true,
			ror: true,
		},
		with: {
			entityVersion: {
				columns: {},
				with: {
					entity: {
						columns: { slug: true },
					},
				},
			},
			socialMedia: {
				columns: {
					url: true,
				},
				with: {
					type: {
						columns: {
							type: true,
						},
					},
				},
			},
		},
		orderBy(t, { asc }) {
			return [asc(t.name)];
		},
	})) as unknown as Array<{
		name: string;
		ror: string | null;
		entityVersion: {
			entity: {
				slug: string;
			};
		};
		socialMedia: Array<{
			url: string;
			type: {
				type: string;
			};
		}>;
	}>;

	return items.map((item) => {
		const website = item.socialMedia.find((sm) => sm.type.type === "website")?.url ?? null;

		return {
			name: item.name,
			ror: item.ror,
			slug: item.entityVersion.entity.slug,
			website,
		};
	});
}

function getPartnerInstitutions(
	db: Database | Transaction,
	countryId: schema.OrganisationalUnit["id"],
) {
	return getInstitutionsByRelation(db, countryId, "is_partner_institution_of");
}

function getCooperatingPartnerInstitutions(
	db: Database | Transaction,
	countryId: schema.OrganisationalUnit["id"],
) {
	return getInstitutionsByRelation(db, countryId, "is_cooperating_partner_of");
}

async function getNationalCoordinatingInstitution(
	db: Database | Transaction,
	countryId: schema.OrganisationalUnit["id"],
) {
	const items = await getInstitutionsByRelation(
		db,
		countryId,
		"is_national_coordinating_institution_in",
	);
	return items.at(0) ?? null;
}

async function getNationalRepresentativeInstitution(
	db: Database | Transaction,
	countryId: schema.OrganisationalUnit["id"],
) {
	const items = await getInstitutionsByRelation(
		db,
		countryId,
		"is_national_representative_institution_in",
	);
	return items.at(0) ?? null;
}

async function getNationalConsortium(
	db: Database | Transaction,
	countryId: string,
	options?: { imageSize?: number; includeDescription?: boolean },
) {
	const item = await db.query.organisationalUnits.findFirst({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
			},
			type: {
				type: "national_consortium",
			},
			RAW(t) {
				return buildActiveRelationToUnitFilter(
					db,
					t.id,
					"is_national_consortium_of",
					"country",
					countryId,
				);
			},
		},
		columns: {
			name: true,
			ror: true,
		},
		with: {
			entityVersion: {
				columns: { id: true },
				with: {
					entity: {
						columns: { slug: true },
					},
				},
			},
			image: {
				columns: {
					key: true,
					alt: true,
					caption: true,
				},
				with: {
					license: {
						columns: {
							name: true,
							url: true,
						},
					},
				},
			},
			socialMedia: {
				columns: {
					url: true,
				},
				with: {
					type: {
						columns: {
							type: true,
						},
					},
				},
			},
		},
	});

	if (item == null) {
		return null;
	}

	const fields =
		options?.includeDescription === true ? await getContentBlocks(db, item.entityVersion.id) : {};
	const website = item.socialMedia.find((sm) => sm.type.type === "website")?.url ?? null;

	return {
		name: item.name,
		slug: item.entityVersion.entity.slug,
		ror: item.ror,
		website,
		image: generateImageUrl(item.image, options?.imageSize ?? imageWidth.preview),
		description: fields.description,
	};
}

async function getContributors(db: Database | Transaction, countryId: string) {
	// countryId is a published org version id; resolve it to its document id once here.
	const countryDocumentId = await resolveDocumentId(db, countryId);
	const rows = await db
		.select({
			id: schema.persons.id,
			name: schema.persons.name,
			slug: schema.entities.slug,
			imageKey: schema.assets.key,
			imageAlt: schema.assets.alt,
			imageCaption: schema.assets.caption,
			licenseName: schema.licenses.name,
			licenseUrl: schema.licenses.url,
			role: schema.personRoleTypes.type,
		})
		.from(schema.personsToOrganisationalUnits)
		// person↔org relations are document-level; resolve the person to its published version and
		// match the org by its document id (countryId is a published org version id).
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(schema.persons, eq(schema.persons.id, schema.documentLifecycle.publishedId))
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.leftJoin(schema.assets, eq(schema.persons.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personsToOrganisationalUnits.roleTypeId, schema.personRoleTypes.id),
		)
		.where(
			and(
				eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, countryDocumentId),
				sql`${schema.personsToOrganisationalUnits.duration} @> NOW()::TIMESTAMPTZ`,
				sql`
					${schema.personRoleTypes.type} IN (
						'national_coordinator',
						'national_coordinator_deputy',
						'national_representative',
						'national_representative_deputy'
					)
				`,
			),
		);

	// national_coordinator(_deputy) and national_representative(_deputy) are non-exclusive: a person may
	// legitimately hold a coordinator and a representative relation, and should then be listed once per
	// role. Collapse only exact duplicates (same person and role) so a stray duplicate relation row
	// cannot list the same contributor twice with an identical role.
	const rowsByPersonAndRole = new Map<string, (typeof rows)[number]>();
	for (const row of rows) {
		const key = `${row.id}:${row.role}`;
		if (!rowsByPersonAndRole.has(key)) {
			rowsByPersonAndRole.set(key, row);
		}
	}

	const contributors = [...rowsByPersonAndRole.values()].toSorted((a, b) => {
		const byName = a.name.localeCompare(b.name);
		if (byName !== 0) {
			return byName;
		}
		const byRole = a.role.localeCompare(b.role);
		if (byRole !== 0) {
			return byRole;
		}
		return a.id.localeCompare(b.id);
	});

	const positions = await getPersonPositions(db, [...new Set(contributors.map((row) => row.id))]);

	return mapPersonContributors(contributors, positions);
}

interface GetMemberOrPartnerByIdParams {
	id: schema.OrganisationalUnit["id"];
}

export async function getMemberOrPartnerById(
	db: Database | Transaction,
	params: GetMemberOrPartnerByIdParams,
) {
	const { id } = params;

	const [item, fields, relatedEntities, relatedResources] = await Promise.all([
		db.query.membersAndPartners.findFirst({
			where: {
				id,
				entityVersion: {
					status: {
						type: "published",
					},
				},
			},
			columns: {
				id: true,
				metadata: true,
				name: true,
				summary: true,
				status: true,
				type: true,
				sshocMarketplaceActorId: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true },
						},
					},
				},
				image: {
					columns: {
						key: true,
						alt: true,
						caption: true,
					},
					with: {
						license: {
							columns: {
								name: true,
								url: true,
							},
						},
					},
				},
				socialMedia: {
					columns: {
						id: true,
						name: true,
						url: true,
						duration: true,
					},
					with: {
						type: {
							columns: {
								type: true,
							},
						},
					},
				},
			},
		}),
		getContentBlocks(db, id),
		getRelatedEntities(db, id),
		getRelatedResources(db, id),
	]);

	if (item == null) {
		return null;
	}

	const base = {
		...flattenEntityVersion(item),
		socialMedia: mapSocialMedia(item.socialMedia),
		...fields,
		relatedEntities,
		relatedResources,
	};

	if (item.status === "is_member_of" || item.status === "is_observer_of") {
		const [
			institutions,
			contributors,
			nationalCoordinatingInstitution,
			nationalRepresentativeInstitution,
			nationalConsortium,
		] = await Promise.all([
			getPartnerInstitutions(db, item.id),
			getContributors(db, item.id),
			getNationalCoordinatingInstitution(db, item.id),
			getNationalRepresentativeInstitution(db, item.id),
			getNationalConsortium(db, item.id, {
				imageSize: imageWidth.featured,
				includeDescription: true,
			}),
		]);

		const image = nationalConsortium?.image ?? generateImageUrl(item.image, imageWidth.featured);
		const description = hasContentBlocks(nationalConsortium?.description)
			? nationalConsortium.description
			: fields.description;

		return {
			...base,
			status: item.status,
			image,
			description,
			contributors,
			institutions,
			nationalCoordinatingInstitution,
			nationalRepresentativeInstitution,
			nationalConsortium,
		};
	}

	return {
		...base,
		status: item.status,
		image: generateImageUrl(item.image, imageWidth.featured),
		institutions: await getCooperatingPartnerInstitutions(db, item.id),
	};
}

//

interface GetMemberOrPartnerSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getMemberOrPartnerSlugs(
	db: Database | Transaction,
	params: GetMemberOrPartnerSlugsParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.membersAndPartners.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
			},
			columns: {
				id: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true },
						},
					},
				},
				image: {
					columns: {
						key: true,
						alt: true,
						caption: true,
					},
					with: {
						license: {
							columns: {
								name: true,
								url: true,
							},
						},
					},
				},
			},
			orderBy(t, { desc, sql }) {
				return [desc(sql`"entityVersion"."r" ->> 'updatedAt'`)];
			},
			limit,
			offset,
		}),
		db
			.select({ total: count() })
			.from(schema.membersAndPartners)
			.innerJoin(schema.entityVersions, eq(schema.membersAndPartners.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map(({ id, entityVersion }) => {
		return { id, entity: { slug: entityVersion.entity.slug } };
	});

	return { data, limit, offset, total };
}

//

interface GetMemberOrPartnerBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getMemberOrPartnerBySlug(
	db: Database | Transaction,
	params: GetMemberOrPartnerBySlugParams,
) {
	const { slug } = params;

	const item = await db.query.membersAndPartners.findFirst({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
				entity: {
					slug,
				},
			},
		},
		columns: {
			id: true,
			metadata: true,
			name: true,
			summary: true,
			status: true,
			type: true,
			sshocMarketplaceActorId: true,
		},
		with: {
			entityVersion: {
				columns: { updatedAt: true },
				with: {
					entity: {
						columns: { slug: true },
					},
				},
			},
			image: {
				columns: {
					key: true,
					alt: true,
					caption: true,
				},
				with: {
					license: {
						columns: {
							name: true,
							url: true,
						},
					},
				},
			},
			socialMedia: {
				columns: {
					id: true,
					name: true,
					url: true,
					duration: true,
				},
				with: {
					type: {
						columns: {
							type: true,
						},
					},
				},
			},
		},
	});

	if (item == null) {
		return null;
	}

	const [fields, relatedEntities, relatedResources] = await Promise.all([
		getContentBlocks(db, item.id),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
	]);

	const base = {
		...flattenEntityVersion(item),
		socialMedia: mapSocialMedia(item.socialMedia),
		...fields,
		relatedEntities,
		relatedResources,
	};

	if (item.status === "is_member_of" || item.status === "is_observer_of") {
		const [
			institutions,
			contributors,
			nationalCoordinatingInstitution,
			nationalRepresentativeInstitution,
			nationalConsortium,
		] = await Promise.all([
			getPartnerInstitutions(db, item.id),
			getContributors(db, item.id),
			getNationalCoordinatingInstitution(db, item.id),
			getNationalRepresentativeInstitution(db, item.id),
			getNationalConsortium(db, item.id, {
				imageSize: imageWidth.featured,
				includeDescription: true,
			}),
		]);

		const image = nationalConsortium?.image ?? generateImageUrl(item.image, imageWidth.featured);
		const description = hasContentBlocks(nationalConsortium?.description)
			? nationalConsortium.description
			: fields.description;

		return {
			...base,
			status: item.status,
			image,
			description,
			contributors,
			institutions,
			nationalCoordinatingInstitution,
			nationalRepresentativeInstitution,
			nationalConsortium,
		};
	}

	return {
		...base,
		status: item.status,
		image: generateImageUrl(item.image, imageWidth.featured),
		institutions: await getCooperatingPartnerInstitutions(db, item.id),
	};
}
