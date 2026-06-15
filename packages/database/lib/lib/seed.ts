// oxlint-disable oxc/no-map-spread

import { groupBy, keyBy } from "@acdh-oeaw/lib";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { eq } from "drizzle-orm";

import * as schema from "../schema";
import type { Client } from "./admin-client";

interface SeedManifest {
	avatars: Array<{
		key: string;
		mimeType: string;
		label: string;
	}>;
	images: Array<{
		key: string;
		mimeType: string;
		label: string;
	}>;
}

export interface SeedConfig {
	/** @default "2025-01-01" */
	defaultRefDate?: Date;
	/** Default 42 */
	seed?: number;
	seedManifest?: SeedManifest;
}

type SeedTx = Parameters<Parameters<Client["transaction"]>[0]>[0];

interface DocumentVersion {
	documentId: string;
	versionId: string;
}

/**
 * For each input slug: insert one `entities` row (the document) and one `entity_versions` row
 * referencing it. Returns the pair of ids per input, in the same order, so callers can attach
 * subtype data by index.
 */
async function createDocumentVersions(
	db: SeedTx,
	typeId: string,
	statusId: string,
	slugs: ReadonlyArray<string>,
): Promise<Array<DocumentVersion>> {
	if (slugs.length === 0) {
		return [];
	}

	const documents = await db
		.insert(schema.entities)
		.values(
			slugs.map((slug) => {
				return { typeId, slug };
			}),
		)
		.returning({ id: schema.entities.id });

	const versions = await db
		.insert(schema.entityVersions)
		.values(
			documents.map((document) => {
				return { entityId: document.id, statusId };
			}),
		)
		.returning({ id: schema.entityVersions.id, entityId: schema.entityVersions.entityId });

	return versions.map((version) => {
		return { documentId: version.entityId, versionId: version.id };
	});
}

export async function seed(db: Client, config: SeedConfig = {}): Promise<void> {
	const { defaultRefDate = new Date(Date.UTC(2025, 0, 1)), seed = 42, seedManifest } = config;

	f.seed(seed);
	f.setDefaultRefDate(defaultRefDate);

	await db.transaction(async (db) => {
		const licenseIds = await db.select({ id: schema.licenses.id }).from(schema.licenses);

		const images: Array<schema.AssetInput> = f.helpers.multiple(
			() => {
				const img =
					seedManifest?.images != null
						? f.helpers.arrayElement(seedManifest.images)
						: { key: f.string.uuid(), mimeType: "image/png", label: f.lorem.word() };

				return {
					key: img.key,
					label: img.label,
					mimeType: img.mimeType,
					licenseId: f.helpers.arrayElement(licenseIds).id,
				};
			},
			{ count: 250 },
		);

		const imageIds = await db
			.insert(schema.assets)
			.values(images)
			.returning({ id: schema.assets.id });

		const avatars: Array<schema.AssetInput> = f.helpers.multiple(
			() => {
				const img =
					seedManifest?.avatars != null
						? f.helpers.arrayElement(seedManifest.avatars)
						: { key: f.string.uuid(), mimeType: "image/png", label: f.lorem.word() };

				return {
					key: img.key,
					label: img.label,
					mimeType: img.mimeType,
					licenseId: f.helpers.arrayElement(licenseIds).id,
				};
			},
			{ count: 25 },
		);

		const avatarIds = await db
			.insert(schema.assets)
			.values(avatars)
			.returning({ id: schema.assets.id });

		const entityTypeIds = await db
			.select({ id: schema.entityTypes.id, type: schema.entityTypes.type })
			.from(schema.entityTypes);

		const entityTypesByType = keyBy(entityTypeIds, ({ type }) => type);

		const entityStatusIds = await db
			.select({ id: schema.entityStatus.id, type: schema.entityStatus.type })
			.from(schema.entityStatus);

		const entityStatusByType = keyBy(entityStatusIds, ({ type }) => type);

		const publishedStatusId = entityStatusByType.published.id;

		const fieldNameIds = await db
			.select({
				id: schema.entityTypesFieldsNames.id,
				entityTypeId: schema.entityTypes.id,
				entityType: schema.entityTypes.type,
			})
			.from(schema.entityTypesFieldsNames)
			.innerJoin(
				schema.entityTypes,
				eq(schema.entityTypesFieldsNames.entityTypeId, schema.entityTypes.id),
			);

		const fieldNamesByEntityTypeId = groupBy(fieldNameIds, ({ entityTypeId }) => entityTypeId);

		// All document/version pairs created during seeding, with their entity type id.
		// Used afterward to seed fields (per version) and cross-document relations.
		const seededDocuments: Array<DocumentVersion & { typeId: string }> = [];

		function record(typeId: string, items: ReadonlyArray<DocumentVersion>) {
			for (const item of items) {
				seededDocuments.push({ ...item, typeId });
			}
		}

		const persons: Array<Omit<schema.PersonInput, "id">> = f.helpers.multiple(
			() => {
				const firstName = f.person.firstName();
				const lastName = f.person.lastName();
				const name = f.person.fullName({ firstName, lastName });

				return {
					name,
					sortName: [lastName, firstName].join(" "),
					description: f.lorem.paragraph(),
					imageId: f.helpers.arrayElement(avatarIds).id,
				};
			},
			{ count: 25 },
		);

		const personIds = await createDocumentVersions(
			db,
			entityTypesByType.persons.id,
			publishedStatusId,
			persons.map((p) => slugify(p.sortName)),
		);
		record(entityTypesByType.persons.id, personIds);

		await db.insert(schema.persons).values(
			personIds.map(({ versionId }, index) => {
				return { ...persons[index]!, id: versionId };
			}),
		);

		const events: Array<Omit<schema.EventInput, "id">> = f.helpers.multiple(
			() => {
				const title = f.lorem.sentence();
				const start = f.date.past({ years: 5 });
				const end = f.helpers.maybe(() => f.date.soon({ refDate: start, days: 7 }), {
					probability: 0.25,
				});
				const isFullDay = f.datatype.boolean({ probability: 0.5 });
				if (isFullDay) {
					start.setUTCHours(0, 0, 0, 0);
					end?.setUTCHours(23, 59, 59, 999);
				}

				return {
					title,
					summary: f.lorem.paragraph(),
					imageId: f.helpers.arrayElement(imageIds).id,
					location: f.location.city(),
					duration: {
						start,
						end,
					},
					isFullDay,
					website: f.helpers.maybe(() => f.internet.url(), { probability: 0.75 }),
				};
			},
			{ count: 25 },
		);

		const eventIds = await createDocumentVersions(
			db,
			entityTypesByType.events.id,
			publishedStatusId,
			events.map((e) => slugify(e.title)),
		);
		record(entityTypesByType.events.id, eventIds);

		await db.insert(schema.events).values(
			eventIds.map(({ versionId }, index) => {
				return { ...events[index]!, id: versionId };
			}),
		);

		const impactCaseStudies: Array<Omit<schema.ImpactCaseStudyInput, "id">> = f.helpers.multiple(
			() => {
				const title = f.lorem.sentence();

				return {
					title,
					summary: f.lorem.paragraph(),
					imageId: f.helpers.arrayElement(imageIds).id,
				};
			},
			{ count: 25 },
		);

		const impactCaseStudyIds = await createDocumentVersions(
			db,
			entityTypesByType.impact_case_studies.id,
			publishedStatusId,
			impactCaseStudies.map((s) => slugify(s.title)),
		);
		record(entityTypesByType.impact_case_studies.id, impactCaseStudyIds);

		await db.insert(schema.impactCaseStudies).values(
			impactCaseStudyIds.map(({ versionId }, index) => {
				return { ...impactCaseStudies[index]!, id: versionId };
			}),
		);

		// Contributors are document-level; key both endpoints to their document ids.
		const impactCaseStudiesToPersons = impactCaseStudyIds.flatMap(
			({ documentId: impactCaseStudyDocumentId }) => {
				const selected = f.helpers.arrayElements(personIds, { min: 0, max: 3 });
				return selected.map(({ documentId: personDocumentId }) => {
					return { impactCaseStudyDocumentId, personDocumentId };
				});
			},
		);

		await db.insert(schema.impactCaseStudiesToPersons).values(impactCaseStudiesToPersons);

		const news: Array<Omit<schema.NewsItemInput, "id">> = f.helpers.multiple(
			() => {
				const title = f.lorem.sentence();

				return {
					title,
					summary: f.lorem.paragraph(),
					imageId: f.helpers.arrayElement(imageIds).id,
				};
			},
			{ count: 25 },
		);

		const newsItemIds = await createDocumentVersions(
			db,
			entityTypesByType.news.id,
			publishedStatusId,
			news.map((n) => slugify(n.title)),
		);
		record(entityTypesByType.news.id, newsItemIds);

		await db.insert(schema.news).values(
			newsItemIds.map(({ versionId }, index) => {
				return { ...news[index]!, id: versionId };
			}),
		);

		const pages: Array<Omit<schema.PageInput, "id">> = f.helpers.multiple(
			() => {
				const title = f.lorem.sentence();

				return {
					title,
					summary: f.lorem.paragraph(),
					imageId: f.helpers.arrayElement(imageIds).id,
				};
			},
			{ count: 25 },
		);

		const pageIds = await createDocumentVersions(
			db,
			entityTypesByType.pages.id,
			publishedStatusId,
			pages.map((p) => slugify(p.title)),
		);
		record(entityTypesByType.pages.id, pageIds);

		await db.insert(schema.pages).values(
			pageIds.map(({ versionId }, index) => {
				return { ...pages[index]!, id: versionId };
			}),
		);

		const documentationPages: Array<Omit<schema.DocumentationPageInput, "id">> = f.helpers.multiple(
			() => {
				return {
					title: f.lorem.sentence(),
				};
			},
			{ count: 25 },
		);

		const documentationPageIds = await createDocumentVersions(
			db,
			entityTypesByType.documentation_pages.id,
			publishedStatusId,
			documentationPages.map((p) => slugify(p.title)),
		);
		record(entityTypesByType.documentation_pages.id, documentationPageIds);

		await db.insert(schema.documentationPages).values(
			// oxlint-disable-next-line oxc/no-map-spread
			documentationPageIds.map(({ versionId }, index) => {
				return { ...documentationPages[index]!, id: versionId };
			}),
		);

		const spotlightArticles: Array<Omit<schema.SpotlightArticleInput, "id">> = f.helpers.multiple(
			() => {
				const title = f.lorem.sentence();

				return {
					title,
					summary: f.lorem.paragraph(),
					imageId: f.helpers.arrayElement(imageIds).id,
				};
			},
			{ count: 25 },
		);

		const spotlightArticleIds = await createDocumentVersions(
			db,
			entityTypesByType.spotlight_articles.id,
			publishedStatusId,
			spotlightArticles.map((a) => slugify(a.title)),
		);
		record(entityTypesByType.spotlight_articles.id, spotlightArticleIds);

		await db.insert(schema.spotlightArticles).values(
			spotlightArticleIds.map(({ versionId }, index) => {
				return { ...spotlightArticles[index]!, id: versionId };
			}),
		);

		// fields hang off entity_versions; one row per (version, fieldName) for the version's type
		const fields: Array<schema.FieldInput> = seededDocuments.flatMap(({ versionId, typeId }) =>
			(fieldNamesByEntityTypeId[typeId] ?? []).map((fieldName) => {
				return { entityVersionId: versionId, fieldNameId: fieldName.id };
			}),
		);

		const fieldIds = await db
			.insert(schema.fields)
			.values(fields)
			.returning({ id: schema.fields.id });

		await db
			.insert(schema.contentBlockTypes)
			.values([{ type: "gallery" }])
			.onConflictDoNothing();

		const contentBlockTypeIds = await db
			.select({ id: schema.contentBlockTypes.id, type: schema.contentBlockTypes.type })
			.from(schema.contentBlockTypes);

		const contentBlockTypesById = keyBy(contentBlockTypeIds, ({ id }) => id);
		const contentBlockTypesByType = keyBy(contentBlockTypeIds, ({ type }) => type);

		const contentBlocks: Array<schema.ContentBlockInput> = fieldIds.flatMap(({ id: fieldId }) => [
			{ fieldId, typeId: contentBlockTypesByType.image.id, position: 1 },
			{ fieldId, typeId: contentBlockTypesByType.gallery.id, position: 2 },
			{ fieldId, typeId: contentBlockTypesByType.rich_text.id, position: 3 },
		]);

		const contentBlockIds = await db
			.insert(schema.contentBlocks)
			.values(contentBlocks)
			.returning({ id: schema.contentBlocks.id, typeId: schema.contentBlocks.typeId });

		const contentBlockIdsByType = groupBy(
			contentBlockIds,
			({ typeId }) => contentBlockTypesById[typeId]!.type,
		);

		const imageContentBlocks: Array<schema.ImageContentBlockInput> =
			contentBlockIdsByType.image.map(({ id }) => {
				return {
					id,
					imageId: f.helpers.arrayElement(imageIds).id,
					caption: f.helpers.maybe(() => f.lorem.sentence(), { probability: 0.5 }),
				};
			});

		await db.insert(schema.imageContentBlocks).values(imageContentBlocks);

		const galleryContentBlocks: Array<schema.GalleryContentBlockInput> =
			contentBlockIdsByType.gallery.map(({ id }) => {
				return {
					id,
					layout: "carousel",
				};
			});

		await db.insert(schema.galleryContentBlocks).values(galleryContentBlocks);

		const galleryContentBlockItems: Array<schema.GalleryContentBlockItemInput> =
			contentBlockIdsByType.gallery.flatMap(({ id: galleryContentBlockId }) =>
				f.helpers.arrayElements(imageIds, { min: 3, max: 5 }).map(({ id: imageId }, position) => {
					return {
						galleryContentBlockId,
						imageId,
						position,
						caption: f.helpers.maybe(() => f.lorem.sentence(), { probability: 0.5 }),
					};
				}),
			);

		await db.insert(schema.galleryContentBlockItems).values(galleryContentBlockItems);

		const richTextContentBlocks = contentBlockIdsByType.rich_text.map(({ id }) => {
			return {
				id,
				content: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: f.lorem.paragraph() }],
						},
					],
				},
			};
		});

		await db.insert(schema.richTextContentBlocks).values(richTextContentBlocks);

		// cross-document relations: keyed by documentId (the new entities table)
		const allDocumentIds = seededDocuments.map(({ documentId }) => documentId);

		const entitiesToResources = allDocumentIds.flatMap((entityId) =>
			f.helpers.multiple(
				() => {
					return { entityId, resourceId: f.string.uuid() };
				},
				{ count: f.number.int({ min: 0, max: 5 }) },
			),
		);

		await db.insert(schema.entitiesToResources).values(entitiesToResources);

		const entitiesToEntities = allDocumentIds.flatMap((entityId) =>
			f.helpers.arrayElements(allDocumentIds, { min: 0, max: 5 }).map((relatedEntityId) => {
				return { entityId, relatedEntityId };
			}),
		);

		await db.insert(schema.entitiesToEntities).values(entitiesToEntities);

		const organisationalUnitTypeIds = await db
			.select({ id: schema.organisationalUnitTypes.id, type: schema.organisationalUnitTypes.type })
			.from(schema.organisationalUnitTypes);

		const organisationalUnitsTypesByType = keyBy(organisationalUnitTypeIds, ({ type }) => type);

		const organisationalUnitsAllowedRelationsValues = await db
			.select({
				relatedUnitTypeId: schema.organisationalUnitsAllowedRelations.relatedUnitTypeId,
				relationTypeId: schema.organisationalUnitsAllowedRelations.relationTypeId,
				unitTypeId: schema.organisationalUnitsAllowedRelations.unitTypeId,
			})
			.from(schema.organisationalUnitsAllowedRelations);

		const { eric, ...rest } = organisationalUnitsTypesByType;

		const organisationalUnits: Array<Omit<schema.OrganisationalUnitInput, "id">> =
			f.helpers.multiple(
				(_, i) => {
					const name = f.commerce.productName();

					return {
						name,
						metadata: { country: f.location.country() },
						summary: f.lorem.paragraph(),
						imageId: f.helpers.maybe(() => f.helpers.arrayElement(imageIds).id, {
							probability: 0.5,
						}),
						typeId:
							i === 0
								? eric.id
								: Object.values(rest).map((type) => type.id)[i % Object.values(rest).length]!,
					};
				},
				{ count: 25 },
			);

		const organisationalUnitIds = await createDocumentVersions(
			db,
			entityTypesByType.organisational_units.id,
			publishedStatusId,
			organisationalUnits.map((u) => slugify(u.name)),
		);

		const organisationalUnitsIds = await db
			.insert(schema.organisationalUnits)
			.values(
				// oxlint-disable-next-line oxc/no-map-spread
				organisationalUnitIds.map(({ versionId }, index) => {
					return { ...organisationalUnits[index]!, id: versionId };
				}),
			)
			.returning({ id: schema.organisationalUnits.id, typeId: schema.organisationalUnits.typeId });

		// relations are document-level; zip in each org's document id (same order as the versions).
		const organisationalUnitsWithDocument = organisationalUnitsIds.map((unit, index) => {
			return { ...unit, documentId: organisationalUnitIds[index]!.documentId };
		});

		const seenUnitRelations = new Set<string>();
		const unitsToUnits: Array<schema.OrganisationalUnitRelationInput> = f.helpers
			.multiple(() => f.helpers.arrayElement(organisationalUnitsAllowedRelationsValues), {
				count: 25,
			})
			.map((organisationalUnitsAllowedRelation) => {
				const unit = f.helpers.arrayElement(
					organisationalUnitsWithDocument.filter(
						(organisationalUnit) =>
							organisationalUnit.typeId === organisationalUnitsAllowedRelation.unitTypeId,
					),
				);

				const relatedUnit = f.helpers.arrayElement(
					organisationalUnitsWithDocument.filter(
						(organisationalUnit) =>
							organisationalUnit.typeId === organisationalUnitsAllowedRelation.relatedUnitTypeId,
					),
				);

				const start = f.date.past({ years: 5 });
				const yesterday = new Date();
				yesterday.setDate(yesterday.getDate() - 1);
				const minEndDate = new Date(start);
				minEndDate.setFullYear(start.getFullYear() + 1);

				return {
					unitDocumentId: unit.documentId,
					relatedUnitDocumentId: relatedUnit.documentId,
					status: organisationalUnitsAllowedRelation.relationTypeId,
					duration: {
						start,
						end:
							minEndDate < yesterday
								? f.helpers.maybe(() => f.date.between({ from: minEndDate, to: yesterday }), {
										probability: 0.25,
									})
								: undefined,
					},
				};
			})
			.filter((row) => {
				const key = [row.unitDocumentId, row.relatedUnitDocumentId, row.status].join(":");
				if (seenUnitRelations.has(key)) {
					return false;
				}
				seenUnitRelations.add(key);
				return true;
			});

		await db.insert(schema.organisationalUnitsRelations).values(unitsToUnits);

		const personsToOrganisationalUnitsAllowedRelations = await db
			.select({
				roleTypeId: schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.roleTypeId,
				unitTypeId: schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.unitTypeId,
			})
			.from(schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations);

		const seenContributions = new Set<string>();
		const personsToOrganisationalUnits = f.helpers
			.multiple(
				() => {
					const { roleTypeId, unitTypeId } = f.helpers.arrayElement(
						personsToOrganisationalUnitsAllowedRelations,
					);
					const organisationalUnit = f.helpers.arrayElement(
						organisationalUnitsWithDocument.filter(
							(organisationalUnit) => organisationalUnit.typeId === unitTypeId,
						),
					);

					const start = f.date.past({ years: 5 });
					const end = f.helpers.maybe(() => f.date.between({ from: start, to: Date.now() }), {
						probability: 0.25,
					});
					const isFullDay = f.datatype.boolean({ probability: 0.75 });
					if (isFullDay) {
						start.setUTCHours(0, 0, 0, 0);
						end?.setUTCHours(23, 59, 59, 999);
					}

					return {
						personDocumentId: f.helpers.arrayElement(personIds).documentId,
						roleTypeId,
						organisationalUnitDocumentId: organisationalUnit.documentId,
						duration: {
							start,
							end,
						},
					};
				},
				{ count: 10 },
			)
			// the (person, org, role) unique constraint forbids duplicates.
			.filter((row) => {
				const key = [row.personDocumentId, row.organisationalUnitDocumentId, row.roleTypeId].join(
					":",
				);
				if (seenContributions.has(key)) {
					return false;
				}
				seenContributions.add(key);
				return true;
			});

		await db.insert(schema.personsToOrganisationalUnits).values(personsToOrganisationalUnits);
	});
}
