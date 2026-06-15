/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl, toImageAsset } from "@/lib/images";
import { getPersonPositions } from "@/lib/persons";
import { getRelatedEntities, getRelatedResources } from "@/lib/relations";
import { mapSocialMedia } from "@/lib/social-media";
import type { Database, Transaction } from "@/middlewares/db";
import { hardcodedWorkingGroups } from "@/routes/governance-bodies/hardcoded-working-groups";
import { alias, and, count, eq, inArray, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

interface GetGovernanceBodiesParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

interface GovernanceBodyPerson {
	id: string;
	name: string;
	sortName: string;
	email: string | null;
	orcid: string | null;
	position: Awaited<ReturnType<typeof getPersonPositions>> extends Map<string, infer T> ? T : never;
	image: { url: string } | null;
	slug: string;
	role: (typeof schema.personRoleTypesEnum)[number];
	duration: { start: string; end: string | null };
}

// Governance bodies use a single role vocabulary, and a person is not expected to hold more than one
// of these roles at the same body. Rank them so an (unenforced) overlap resolves deterministically to
// the most senior role.
const governanceBodyRolePriority: Partial<
	Record<(typeof schema.personRoleTypesEnum)[number], number>
> = {
	is_chair_of: 0,
	is_vice_chair_of: 1,
	is_member_of: 2,
	is_contact_for: 3,
	is_affiliated_with: 4,
};

function getGovernanceBodyRolePriority(role: (typeof schema.personRoleTypesEnum)[number]): number {
	return governanceBodyRolePriority[role] ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Negative when `a` should be preferred over `b`: most senior role first, then most recent
 * relation.
 */
function comparePreferredRelation(
	a: { role: (typeof schema.personRoleTypesEnum)[number]; duration: { start: Date } },
	b: { role: (typeof schema.personRoleTypesEnum)[number]; duration: { start: Date } },
): number {
	const byRole = getGovernanceBodyRolePriority(a.role) - getGovernanceBodyRolePriority(b.role);
	if (byRole !== 0) {
		return byRole;
	}
	return b.duration.start.getTime() - a.duration.start.getTime();
}

function mapGovernanceBodyPerson(
	row: {
		id: string;
		name: string;
		sortName: string;
		email: string | null;
		orcid: string | null;
		slug: string;
		imageKey: string | null;
		imageAlt: string | null;
		imageCaption: string | null;
		licenseName: string | null;
		licenseUrl: string | null;
		role: (typeof schema.personRoleTypesEnum)[number];
		duration: { start: Date; end?: Date | null };
	},
	positions: Awaited<ReturnType<typeof getPersonPositions>>,
): GovernanceBodyPerson {
	return {
		id: row.id,
		name: row.name,
		sortName: row.sortName,
		email: row.email,
		orcid: row.orcid,
		position: positions.get(row.id) ?? null,
		image: generateImageUrl(
			toImageAsset({
				key: row.imageKey,
				alt: row.imageAlt,
				caption: row.imageCaption,
				licenseName: row.licenseName,
				licenseUrl: row.licenseUrl,
			}),
			imageWidth.avatar,
		),
		slug: row.slug,
		role: row.role,
		duration: {
			start: row.duration.start.toISOString(),
			end: row.duration.end?.toISOString() ?? null,
		},
	};
}

const hardcodedWorkingGroupsGovernanceBody = {
	id: "019b7a56-b301-7f93-9d24-91333bdc3ca8",
	name: "Working groups",
	acronym: null,
	summary:
		"Self-organised communities of practice within DARIAH which contribute to bringing together state-of-art digital arts and humanities activities and scaling their results to a European level.",
	metadata: {},
	image: null,
	entity: { slug: "working-groups" },
	publishedAt: "2026-01-01T00:00:00.000Z",
	socialMedia: [],
};

async function getActiveWorkingGroupChairs(db: Database | Transaction) {
	const workingGroupDocumentLifecycle = alias(
		schema.documentLifecycle,
		"working_group_document_lifecycle",
	);
	const personDocumentLifecycle = alias(schema.documentLifecycle, "person_document_lifecycle");

	const rows = await db
		.select({
			id: schema.persons.id,
			name: schema.persons.name,
			sortName: schema.persons.sortName,
			email: schema.persons.email,
			orcid: schema.persons.orcid,
			slug: schema.entities.slug,
			imageKey: schema.assets.key,
			imageAlt: schema.assets.alt,
			imageCaption: schema.assets.caption,
			licenseName: schema.licenses.name,
			licenseUrl: schema.licenses.url,
			role: schema.personRoleTypes.type,
			duration: schema.personsToOrganisationalUnits.duration,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personsToOrganisationalUnits.roleTypeId, schema.personRoleTypes.id),
		)
		// person↔org relations are document-level; resolve each endpoint to its published version.
		.innerJoin(
			workingGroupDocumentLifecycle,
			eq(
				workingGroupDocumentLifecycle.documentId,
				schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			),
		)
		.innerJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, workingGroupDocumentLifecycle.publishedId),
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.innerJoin(
			personDocumentLifecycle,
			eq(personDocumentLifecycle.documentId, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(schema.persons, eq(schema.persons.id, personDocumentLifecycle.publishedId))
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.leftJoin(schema.assets, eq(schema.persons.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.where(
			and(
				eq(schema.personRoleTypes.type, "is_chair_of"),
				eq(schema.organisationalUnitTypes.type, "working_group"),
				sql`${schema.personsToOrganisationalUnits.duration} @> NOW()::TIMESTAMPTZ`,
			),
		);

	// A person can chair several working groups; keep one entry each, preferring the most recent
	// relation so the surfaced duration is deterministic.
	const chairRowsByPerson = new Map<string, (typeof rows)[number]>();

	for (const row of rows) {
		const existing = chairRowsByPerson.get(row.id);
		if (existing == null || comparePreferredRelation(row, existing) < 0) {
			chairRowsByPerson.set(row.id, row);
		}
	}

	const positions = await getPersonPositions(db, [...chairRowsByPerson.keys()]);

	return [...chairRowsByPerson.values()]
		.map((row) => mapGovernanceBodyPerson(row, positions))
		.toSorted((a, b) => {
			const byName = a.sortName.localeCompare(b.sortName);
			if (byName !== 0) {
				return byName;
			}
			return a.name.localeCompare(b.name);
		});
}

async function getHardcodedWorkingGroupsGovernanceBody(db: Database | Transaction) {
	return {
		...hardcodedWorkingGroupsGovernanceBody,
		persons: await getActiveWorkingGroupChairs(db),
	};
}

async function getHardcodedWorkingGroupsGovernanceBodyDetails(db: Database | Transaction) {
	return {
		...(await getHardcodedWorkingGroupsGovernanceBody(db)),
		description: hardcodedWorkingGroups.description,
		relatedEntities: [],
		relatedResources: [],
	};
}

async function getActiveGovernanceBodyPersons(
	db: Database | Transaction,
	governanceBodyIds: Array<string>,
) {
	const personsByGovernanceBody = new Map<string, Array<GovernanceBodyPerson>>();

	for (const governanceBodyId of governanceBodyIds) {
		personsByGovernanceBody.set(governanceBodyId, []);
	}

	if (governanceBodyIds.length === 0) {
		return personsByGovernanceBody;
	}

	// person↔org relations are document-level. `governanceBodyIds` are published GB version ids; the
	// result must stay keyed by those, so re-key through the GB document and resolve persons to their
	// published version.
	const governanceBodyEntityVersions = alias(
		schema.entityVersions,
		"governance_body_entity_versions",
	);
	const personDocumentLifecycle = alias(schema.documentLifecycle, "person_document_lifecycle");

	const rows = await db
		.select({
			governanceBodyId: governanceBodyEntityVersions.id,
			id: schema.persons.id,
			name: schema.persons.name,
			sortName: schema.persons.sortName,
			email: schema.persons.email,
			orcid: schema.persons.orcid,
			slug: schema.entities.slug,
			imageKey: schema.assets.key,
			imageAlt: schema.assets.alt,
			imageCaption: schema.assets.caption,
			licenseName: schema.licenses.name,
			licenseUrl: schema.licenses.url,
			role: schema.personRoleTypes.type,
			duration: schema.personsToOrganisationalUnits.duration,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personsToOrganisationalUnits.roleTypeId, schema.personRoleTypes.id),
		)
		.innerJoin(
			governanceBodyEntityVersions,
			eq(
				governanceBodyEntityVersions.entityId,
				schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			),
		)
		.innerJoin(
			personDocumentLifecycle,
			eq(personDocumentLifecycle.documentId, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(schema.persons, eq(schema.persons.id, personDocumentLifecycle.publishedId))
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.leftJoin(schema.assets, eq(schema.persons.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.where(
			and(
				inArray(governanceBodyEntityVersions.id, governanceBodyIds),
				sql`${schema.personsToOrganisationalUnits.duration} @> NOW()::TIMESTAMPTZ`,
			),
		);

	const positions = await getPersonPositions(db, [...new Set(rows.map((row) => row.id))]);

	// A person should hold a single relation per governance body, but the database does not enforce
	// non-overlapping statuses. Keep one entry per person, deterministically preferring the most
	// senior role (then the most recent duration), so a person is never listed twice.
	const rowsByBodyAndPerson = new Map<string, Map<string, (typeof rows)[number]>>();
	for (const governanceBodyId of governanceBodyIds) {
		rowsByBodyAndPerson.set(governanceBodyId, new Map());
	}

	for (const row of rows) {
		const byPerson = rowsByBodyAndPerson.get(row.governanceBodyId);

		if (byPerson == null) {
			continue;
		}

		const existing = byPerson.get(row.id);
		if (existing == null || comparePreferredRelation(row, existing) < 0) {
			byPerson.set(row.id, row);
		}
	}

	for (const [governanceBodyId, byPerson] of rowsByBodyAndPerson) {
		const items = [...byPerson.values()]
			.map((row) => mapGovernanceBodyPerson(row, positions))
			.toSorted((a, b) => {
				const byName = a.sortName.localeCompare(b.sortName);
				if (byName !== 0) {
					return byName;
				}
				return a.role.localeCompare(b.role);
			});
		personsByGovernanceBody.set(governanceBodyId, items);
	}

	return personsByGovernanceBody;
}

export async function getGovernanceBodies(
	db: Database | Transaction,
	params: GetGovernanceBodiesParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.organisationalUnits.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
				type: {
					type: "governance_body",
				},
			},
			columns: {
				id: true,
				name: true,
				acronym: true,
				summary: true,
				metadata: true,
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
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(eq(schema.organisationalUnitTypes.type, "governance_body")),
	]);

	const total = aggregate.at(0)?.total ?? 0;
	const personsByGovernanceBody = await getActiveGovernanceBodyPersons(
		db,
		items.map((item) => item.id),
	);

	const data = items.map((item) => {
		const image = generateImageUrl(item.image, imageWidth.preview);

		return {
			...flattenEntityVersion(item),
			image,
			socialMedia: mapSocialMedia(item.socialMedia),
			persons: personsByGovernanceBody.get(item.id) ?? [],
		};
	});

	if (offset <= total && offset + limit > total) {
		data.push(await getHardcodedWorkingGroupsGovernanceBody(db));
	}

	return { data, limit, offset, total: total + 1 };
}

interface GetGovernanceBodyByIdParams {
	id: schema.OrganisationalUnit["id"];
}

export async function getGovernanceBodyById(
	db: Database | Transaction,
	params: GetGovernanceBodyByIdParams,
) {
	const { id } = params;

	if (id === hardcodedWorkingGroupsGovernanceBody.id) {
		return getHardcodedWorkingGroupsGovernanceBodyDetails(db);
	}

	const [item, fields, relatedEntities, relatedResources, personsByGovernanceBody] =
		await Promise.all([
			db.query.organisationalUnits.findFirst({
				where: {
					id,
					entityVersion: {
						status: {
							type: "published",
						},
					},
					type: {
						type: "governance_body",
					},
				},
				columns: {
					id: true,
					name: true,
					acronym: true,
					summary: true,
					metadata: true,
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
			getActiveGovernanceBodyPersons(db, [id]),
		]);

	if (item == null) {
		return null;
	}

	const image = generateImageUrl(item.image, imageWidth.featured);

	return {
		...flattenEntityVersion(item),
		image,
		socialMedia: mapSocialMedia(item.socialMedia),
		persons: personsByGovernanceBody.get(item.id) ?? [],
		...fields,
		relatedEntities,
		relatedResources,
	};
}

interface GetGovernanceBodySlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getGovernanceBodySlugs(
	db: Database | Transaction,
	params: GetGovernanceBodySlugsParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.organisationalUnits.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
				type: {
					type: "governance_body",
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
			},
			orderBy(t, { desc, sql }) {
				return [desc(sql`"entityVersion"."r" ->> 'updatedAt'`)];
			},
			limit,
			offset,
		}),
		db
			.select({ total: count() })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(eq(schema.organisationalUnitTypes.type, "governance_body")),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map(({ id, entityVersion }) => {
		return { id, entity: { slug: entityVersion.entity.slug } };
	});

	if (offset <= total && offset + limit > total) {
		data.push({
			id: hardcodedWorkingGroupsGovernanceBody.id,
			entity: hardcodedWorkingGroupsGovernanceBody.entity,
		});
	}

	return { data, limit, offset, total: total + 1 };
}

interface GetGovernanceBodyBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getGovernanceBodyBySlug(
	db: Database | Transaction,
	params: GetGovernanceBodyBySlugParams,
) {
	const { slug } = params;

	if (slug === hardcodedWorkingGroupsGovernanceBody.entity.slug) {
		return getHardcodedWorkingGroupsGovernanceBodyDetails(db);
	}

	const item = await db.query.organisationalUnits.findFirst({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
				entity: {
					slug,
				},
			},
			type: {
				type: "governance_body",
			},
		},
		columns: {
			id: true,
			name: true,
			acronym: true,
			summary: true,
			metadata: true,
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

	const [fields, relatedEntities, relatedResources, personsByGovernanceBody] = await Promise.all([
		getContentBlocks(db, item.id),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
		getActiveGovernanceBodyPersons(db, [item.id]),
	]);

	const image = generateImageUrl(item.image, imageWidth.featured);

	return {
		...flattenEntityVersion(item),
		image,
		socialMedia: mapSocialMedia(item.socialMedia),
		persons: personsByGovernanceBody.get(item.id) ?? [],
		...fields,
		relatedEntities,
		relatedResources,
	};
}
