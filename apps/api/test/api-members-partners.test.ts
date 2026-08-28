import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/middlewares/db";
import type { MemberOrPartner, MemberOrPartnerBase } from "@/routes/members-partners/schemas";
import { eq, inArray } from "@/services/db/sql";
import { createTestClient } from "~/test/lib/create-test-client";
import { seedContentBlock } from "~/test/lib/seed-content-block";
import { withTransaction } from "~/test/lib/with-transaction";

vi.mock("@/services/search", () => {
	return {
		search: {
			collections: {
				resources: {
					search: async ({ filterBy }: { filterBy?: string }) => {
						const ids = filterBy?.match(/id:\[([^\]]+)\]/)?.[1]?.split(",") ?? [];

						return {
							isErr: () => false,
							value: {
								items: ids.map((id) => {
									return {
										document: {
											id,
											label: `Resource ${id}`,
											type: "service",
											links: [`https://example.org/resources/${id}`],
										},
									};
								}),
								pagination: {
									page: 1,
									perPage: ids.length,
									total: ids.length,
									totalPages: ids.length > 0 ? 1 : 0,
								},
								facets: {},
							},
						};
					},
				},
			},
		},
	};
});

const dariahEuSlug = "dariah-eu";

async function getDariahEu(db: Database) {
	const unit = await db.query.organisationalUnits.findFirst({
		columns: { id: true },
		where: { entityVersion: { slug: { value: dariahEuSlug } }, type: { type: "eric" } },
		with: { entityVersion: { columns: { entityId: true } } },
	});

	assert(unit, "No DARIAH-EU organisational unit in database.");

	return { documentId: unit.entityVersion.entityId, versionId: unit.id };
}

function createItems(count: number) {
	const items = f.helpers.multiple(
		() => {
			const versionId = uuidv7();
			const entityId = uuidv7();
			const name = f.lorem.sentence();
			const slug = slugify(name);

			const entity = { id: entityId, slug };
			const version = { id: versionId, entityId };

			const organisationalUnit = {
				id: versionId,
				name,
				summary: f.lorem.paragraph(),
			};

			return { entity, version, organisationalUnit };
		},
		{ count },
	);

	return items;
}

function createAsset(label = f.lorem.words(2)) {
	const id = uuidv7();

	return {
		id,
		key: `logos/${id}.jpg`,
		label,
		mimeType: "image/jpeg",
	};
}

function createRichTextContent(text: string) {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text }],
			},
		],
	};
}

function createRelatedPage() {
	const versionId = uuidv7();
	const entityId = uuidv7();
	const title = f.lorem.sentence();
	const slug = slugify(title);

	return {
		entity: { id: entityId, slug },
		version: { id: versionId, entityId },
		page: {
			id: versionId,
			title,
			summary: f.lorem.paragraph(),
			publicationDate: f.date.past(),
		},
	};
}

function createPersonItems(count: number) {
	return f.helpers.multiple(
		() => {
			const versionId = uuidv7();
			const entityId = uuidv7();
			const assetId = uuidv7();
			const name = f.person.fullName();
			const slug = slugify(name);
			const affiliationVersionId = uuidv7();
			const affiliationEntityId = uuidv7();
			const affiliationName = f.company.name();

			return {
				entity: { id: entityId, slug },
				version: { id: versionId, entityId },
				asset: {
					id: assetId,
					key: `persons/${assetId}.jpg`,
					label: name,
					mimeType: "image/jpeg",
				},
				person: {
					id: versionId,
					name,
					sortName: f.person.lastName(),
					email: f.internet.email(),
					orcid: `0000-000${String(f.number.int({ min: 1, max: 9 }))}-${String(f.number.int({ min: 1000, max: 9999 }))}-${String(f.number.int({ min: 1000, max: 9999 }))}`,
					imageId: assetId,
				},
				affiliation: {
					entity: { id: affiliationEntityId, slug: slugify(affiliationName) },
					version: { id: affiliationVersionId, entityId: affiliationEntityId },
					organisationalUnit: {
						id: affiliationVersionId,
						name: affiliationName,
						summary: f.lorem.paragraph(),
					},
				},
			};
		},
		{ count },
	);
}

async function seedCooperatingPartner(
	db: Database,
	ericUnitId: string,
	items: ReturnType<typeof createItems>,
) {
	const [institutionType, countryType, locatedInStatus, cooperatingPartnerStatus] =
		await Promise.all([
			db.query.organisationalUnitTypes.findFirst({
				columns: { id: true },
				where: { type: "institution" },
			}),
			db.query.organisationalUnitTypes.findFirst({
				columns: { id: true },
				where: { type: "country" },
			}),
			db.query.organisationalUnitStatus.findFirst({
				columns: { id: true },
				where: { status: "is_located_in" },
			}),
			db.query.organisationalUnitStatus.findFirst({
				columns: { id: true },
				where: { status: "is_cooperating_partner_of" },
			}),
		]);

	assert(institutionType, "No institution type in database.");
	assert(countryType, "No country type in database.");
	assert(locatedInStatus, "No is_located_in status in database.");
	assert(cooperatingPartnerStatus, "No is_cooperating_partner_of status in database.");

	const [country, institution] = items;
	assert(country);
	assert(institution);

	// unit↔unit relations are document-level; resolve the eric version id to its document id.
	const ericDocument = await db.query.entityVersions.findFirst({
		columns: { entityId: true },
		where: { id: ericUnitId },
	});
	assert(ericDocument, "No eric entity version in database.");

	const start = f.date.past({ years: 5 });

	await db.insert(schema.organisationalUnits).values([
		{ ...country.organisationalUnit, typeId: countryType.id },
		{ ...institution.organisationalUnit, typeId: institutionType.id },
	]);

	await db.insert(schema.organisationalUnitsRelations).values([
		{
			unitDocumentId: institution.entity.id,
			relatedUnitDocumentId: country.entity.id,
			status: locatedInStatus.id,
			duration: { start },
		},
		{
			unitDocumentId: institution.entity.id,
			relatedUnitDocumentId: ericDocument.entityId,
			status: cooperatingPartnerStatus.id,
			duration: { start },
		},
	]);
}

async function seedPartnerInstitutions(
	db: Database,
	ericUnitId: string,
	countryId: string,
	items: ReturnType<typeof createItems>,
	relationStatus:
		| "is_partner_institution_of"
		| "is_national_coordinating_institution_in"
		| "is_national_representative_institution_in" = "is_partner_institution_of",
) {
	const [
		status,
		entityType,
		institutionType,
		locatedInStatus,
		partnerInstitutionStatus,
		defaultLocale,
	] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.organisationalUnitTypes.findFirst({
			columns: { id: true },
			where: { type: "institution" },
		}),
		db.query.organisationalUnitStatus.findFirst({
			columns: { id: true },
			where: { status: "is_located_in" },
		}),
		db.query.organisationalUnitStatus.findFirst({
			columns: { id: true },
			where: { status: relationStatus },
		}),
		db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(institutionType, "No institution type in database.");
	assert(locatedInStatus, "No is_located_in status in database.");
	assert(partnerInstitutionStatus, `No ${relationStatus} status in database.`);
	assert(defaultLocale, "No default locale in database.");
	const localeId = defaultLocale.id;

	const [institution] = items;
	assert(institution);

	// unit↔unit relations are document-level; resolve the version ids to their document ids.
	const [ericDocument, countryDocument] = await Promise.all([
		db.query.entityVersions.findFirst({ columns: { entityId: true }, where: { id: ericUnitId } }),
		db.query.entityVersions.findFirst({ columns: { entityId: true }, where: { id: countryId } }),
	]);
	assert(ericDocument, "No eric entity version in database.");
	assert(countryDocument, "No country entity version in database.");

	const start = f.date.past({ years: 5 });

	await db.insert(schema.entities).values({
		id: institution.entity.id,
		typeId: entityType.id,
	});

	await db.insert(schema.entityVersions).values({
		...institution.version,
		statusId: status.id,
		localeId,
	});

	await db.insert(schema.slugs).values({
		entityVersionId: institution.version.id,
		entityId: institution.entity.id,
		typeId: entityType.id,
		localeId,
		isPublished: true,
		value: institution.entity.slug,
	});

	await db.insert(schema.organisationalUnits).values({
		...institution.organisationalUnit,
		typeId: institutionType.id,
	});

	await db.insert(schema.organisationalUnitsRelations).values([
		{
			unitDocumentId: institution.entity.id,
			relatedUnitDocumentId: countryDocument.entityId,
			status: locatedInStatus.id,
			duration: { start },
		},
		{
			unitDocumentId: institution.entity.id,
			relatedUnitDocumentId: ericDocument.entityId,
			status: partnerInstitutionStatus.id,
			duration: { start },
		},
	]);
}

async function seedContributor(
	db: Database,
	countryId: string,
	items: ReturnType<typeof createPersonItems>,
	role: (typeof schema.personRoleTypesEnum)[number] = "national_coordinator",
) {
	const [
		status,
		entityType,
		organisationalUnitEntityType,
		personRoleType,
		affiliatedRoleType,
		institutionType,
		defaultLocale,
	] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "persons" },
		}),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.personRoleTypes.findFirst({
			columns: { id: true },
			where: { type: role },
		}),
		db.query.personRoleTypes.findFirst({
			columns: { id: true },
			where: { type: "is_affiliated_with" },
		}),
		db.query.organisationalUnitTypes.findFirst({
			columns: { id: true },
			where: { type: "institution" },
		}),
		db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(organisationalUnitEntityType, "No organisational unit entity type in database.");
	assert(personRoleType, "No person role type in database.");
	assert(affiliatedRoleType, "No affiliated role type in database.");
	assert(institutionType, "No institution type in database.");
	assert(defaultLocale, "No default locale in database.");
	const localeId = defaultLocale.id;

	const [person] = items;
	assert(person);

	// person↔org relations are document-level; resolve the country version id to its document id.
	const countryDocument = await db.query.entityVersions.findFirst({
		columns: { entityId: true },
		where: { id: countryId },
	});
	assert(countryDocument, "No country entity version in database.");

	const start = f.date.past({ years: 5 });

	await db.insert(schema.assets).values(person.asset);
	await db.insert(schema.entities).values({
		id: person.entity.id,
		typeId: entityType.id,
	});
	await db.insert(schema.entityVersions).values({
		...person.version,
		statusId: status.id,
		localeId,
	});
	await db.insert(schema.slugs).values({
		entityVersionId: person.version.id,
		entityId: person.entity.id,
		typeId: entityType.id,
		localeId,
		isPublished: true,
		value: person.entity.slug,
	});
	await db.insert(schema.persons).values(person.person);
	await db.insert(schema.entities).values({
		id: person.affiliation.entity.id,
		typeId: organisationalUnitEntityType.id,
	});
	await db.insert(schema.entityVersions).values({
		...person.affiliation.version,
		statusId: status.id,
		localeId,
	});
	await db.insert(schema.slugs).values({
		entityVersionId: person.affiliation.version.id,
		entityId: person.affiliation.entity.id,
		typeId: organisationalUnitEntityType.id,
		localeId,
		isPublished: true,
		value: person.affiliation.entity.slug,
	});
	await db.insert(schema.organisationalUnits).values({
		...person.affiliation.organisationalUnit,
		typeId: institutionType.id,
	});
	await db.insert(schema.personsToOrganisationalUnits).values({
		personDocumentId: person.entity.id,
		organisationalUnitDocumentId: countryDocument.entityId,
		roleTypeId: personRoleType.id,
		duration: { start },
	});
	await db.insert(schema.personsToOrganisationalUnits).values({
		personDocumentId: person.entity.id,
		organisationalUnitDocumentId: person.affiliation.entity.id,
		roleTypeId: affiliatedRoleType.id,
		duration: { start },
	});

	return person;
}

async function seedNationalConsortium(
	db: Database,
	countryId: string,
	items: ReturnType<typeof createItems>,
) {
	const [status, entityType, consortiumType, nationalConsortiumStatus, asset, defaultLocale] =
		await Promise.all([
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
			db.query.entityTypes.findFirst({
				columns: { id: true },
				where: { type: "organisational_units" },
			}),
			db.query.organisationalUnitTypes.findFirst({
				columns: { id: true },
				where: { type: "national_consortium" },
			}),
			db.query.organisationalUnitStatus.findFirst({
				columns: { id: true },
				where: { status: "is_national_consortium_of" },
			}),
			db.query.assets.findFirst({ columns: { id: true } }),
			db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
		]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(consortiumType, "No national consortium type in database.");
	assert(nationalConsortiumStatus, "No is_national_consortium_of status in database.");
	assert(asset, "No asset in database.");
	assert(defaultLocale, "No default locale in database.");
	const localeId = defaultLocale.id;

	const [consortium] = items;
	assert(consortium);

	// unit↔unit relations are document-level; resolve the country version id to its document id.
	const countryDocument = await db.query.entityVersions.findFirst({
		columns: { entityId: true },
		where: { id: countryId },
	});
	assert(countryDocument, "No country entity version in database.");

	const start = f.date.past({ years: 5 });

	await db.insert(schema.entities).values({
		id: consortium.entity.id,
		typeId: entityType.id,
	});

	await db.insert(schema.entityVersions).values({
		...consortium.version,
		statusId: status.id,
		localeId,
	});

	await db.insert(schema.slugs).values({
		entityVersionId: consortium.version.id,
		entityId: consortium.entity.id,
		typeId: entityType.id,
		localeId,
		isPublished: true,
		value: consortium.entity.slug,
	});

	await db.insert(schema.organisationalUnits).values({
		...consortium.organisationalUnit,
		typeId: consortiumType.id,
		imageId: asset.id,
	});

	await db.insert(schema.organisationalUnitsRelations).values({
		unitDocumentId: consortium.entity.id,
		relatedUnitDocumentId: countryDocument.entityId,
		status: nationalConsortiumStatus.id,
		duration: { start },
	});

	return consortium;
}

async function seedRelatedPage(db: Database, page: ReturnType<typeof createRelatedPage>) {
	const [status, pageType, asset, defaultLocale] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "pages" } }),
		db.query.assets.findFirst({ columns: { id: true } }),
		db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(pageType, "No page entity type in database.");
	assert(asset, "No assets in database.");
	assert(defaultLocale, "No default locale in database.");
	const localeId = defaultLocale.id;

	await db.insert(schema.entities).values({
		id: page.entity.id,
		typeId: pageType.id,
	});
	await db.insert(schema.entityVersions).values({
		...page.version,
		statusId: status.id,
		localeId,
	});
	await db.insert(schema.slugs).values({
		entityVersionId: page.version.id,
		entityId: page.entity.id,
		typeId: pageType.id,
		localeId,
		isPublished: true,
		value: page.entity.slug,
	});
	await db.insert(schema.pages).values({
		...page.page,
		imageId: asset.id,
	});
}

async function seedSocialMedia(
	db: Database,
	organisationalUnitId: string,
	typeName: (typeof schema.socialMediaTypesEnum)[number],
	url: string,
) {
	const type = await db.query.socialMediaTypes.findFirst({
		columns: { id: true },
		where: { type: typeName },
	});

	assert(type, `No ${typeName} social media type in database.`);

	const [socialMedia] = await db
		.insert(schema.socialMedia)
		.values({
			name: f.internet.displayName(),
			url,
			duration: { start: f.date.past() },
			typeId: type.id,
		})
		.returning({
			id: schema.socialMedia.id,
			name: schema.socialMedia.name,
			url: schema.socialMedia.url,
		});

	assert(socialMedia);

	await db.insert(schema.organisationalUnitsToSocialMedia).values({
		organisationalUnitId,
		socialMediaId: socialMedia.id,
	});

	return { ...socialMedia, type: typeName };
}

async function seed(
	db: Database,
	items: ReturnType<typeof createItems>,
	descriptionContentByVersionId = new Map<string, Parameters<typeof seedContentBlock>[4]>(),
) {
	const umbrella = await getDariahEu(db);
	items[0]!.entity.id = umbrella.documentId;
	items[0]!.version.id = umbrella.versionId;
	items[0]!.organisationalUnit.id = umbrella.versionId;
	const [status, entityType, asset, countryType, memberObserverStatus, defaultLocale] =
		await Promise.all([
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
			db.query.entityTypes.findFirst({
				columns: { id: true },
				where: { type: "organisational_units" },
			}),
			db.query.assets.findFirst({ columns: { id: true } }),
			db.query.organisationalUnitTypes.findFirst({
				columns: { id: true },
				where: { type: "country" },
			}),
			db
				.select()
				.from(schema.organisationalUnitStatus)
				.where(inArray(schema.organisationalUnitStatus.status, ["is_member_of", "is_observer_of"])),
			db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
		]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(asset, "No assets in database.");
	assert(countryType, "No country type in database.");
	assert(memberObserverStatus.length, "No member or observer status in database.");
	assert(defaultLocale, "No default locale in database.");
	const localeId = defaultLocale.id;

	await db.insert(schema.entities).values(
		items.slice(1).map((item) => {
			return { id: item.entity.id, typeId: entityType.id };
		}),
	);

	await db.insert(schema.entityVersions).values(
		items.slice(1).map((item) => {
			return { ...item.version, statusId: status.id, localeId };
		}),
	);

	await db.insert(schema.slugs).values(
		items.slice(1).map((item) => {
			return {
				entityVersionId: item.version.id,
				entityId: item.entity.id,
				typeId: entityType.id,
				localeId,
				isPublished: true,
				value: item.entity.slug,
			};
		}),
	);

	await db.insert(schema.organisationalUnits).values(
		items.slice(1).map((item) => {
			return { ...item.organisationalUnit, typeId: countryType.id, imageId: asset.id };
		}),
	);

	const start = f.date.past({ years: 5 });

	await db.insert(schema.organisationalUnitsRelations).values(
		items.slice(1).map((item) => {
			return {
				unitDocumentId: item.entity.id,
				relatedUnitDocumentId: umbrella.documentId,
				status: f.helpers.arrayElement(memberObserverStatus).id,
				duration: {
					start,
				},
			};
		}),
	);

	await Promise.all(
		items.map((item) =>
			seedContentBlock(
				db,
				item.version.id,
				entityType.id,
				"description",
				descriptionContentByVersionId.get(item.version.id),
			),
		),
	);
}

describe("members-partners", () => {
	describe("GET /api/members-partners", () => {
		it("should return country with cooperating partner institution", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const [status, entityType, defaultLocale] = await Promise.all([
					db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
					db.query.entityTypes.findFirst({
						columns: { id: true },
						where: { type: "organisational_units" },
					}),
					db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
				]);

				assert(status);
				assert(entityType);
				assert(defaultLocale);
				const localeId = defaultLocale.id;
				const umbrella = await getDariahEu(db);

				// country + institution as cooperating partner
				const partnerItems = createItems(2);
				await db.insert(schema.entities).values(
					partnerItems.map((item) => {
						return {
							id: item.entity.id,
							typeId: entityType.id,
						};
					}),
				);
				await db.insert(schema.entityVersions).values(
					partnerItems.map((item) => {
						return {
							...item.version,
							statusId: status.id,
							localeId,
						};
					}),
				);
				await db.insert(schema.slugs).values(
					partnerItems.map((item) => {
						return {
							entityVersionId: item.version.id,
							entityId: item.entity.id,
							typeId: entityType.id,
							localeId,
							isPublished: true,
							value: item.entity.slug,
						};
					}),
				);
				await seedCooperatingPartner(db, umbrella.versionId, partnerItems);

				const country = partnerItems[0]!;

				const response = await client["members-partners"].$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = (await response.json()) as {
					data: Array<{
						name: string;
						status: string;
					}>;
					limit: number;
					offset: number;
					total: number;
				};

				expect(data.data).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							name: country.organisationalUnit.name,
							status: "is_cooperating_partner_of",
						}),
					]),
				);
			});
		});

		it("should return paginated list of members and partners", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(5);
				await seed(db, items);

				const item = items.at(1)!;
				const name = item.organisationalUnit.name;

				const response = await client["members-partners"].$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = (await response.json()) as {
					data: Array<{
						name: string;
						status: string;
					}>;
					limit: number;
					offset: number;
					total: number;
				};

				expect(data.total).toBeGreaterThanOrEqual(items.length - 1);
				expect(data.data).toEqual(expect.arrayContaining([expect.objectContaining({ name })]));
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});

		it("should order members and partners by organisation name", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const items = createItems(4);
				const expectedNames = [
					"Alphabetical organisation",
					"Middle organisation",
					"Zulu organisation",
				];

				items[1]!.organisationalUnit.name = expectedNames[2]!;
				items[2]!.organisationalUnit.name = expectedNames[0]!;
				items[3]!.organisationalUnit.name = expectedNames[1]!;
				await seed(db, items);

				const response = await client["members-partners"].$get({
					query: { limit: "100" },
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				const seededIds = new Set(items.slice(1).map((item) => item.version.id));
				const names = data.data.filter((item) => seededIds.has(item.id)).map((item) => item.name);

				expect(names).toEqual(expectedNames);
			});
		});
	});

	describe("GET /api/members-partners/:id", () => {
		it("should return single member or partner", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(5);
				await seed(db, items);

				const item = items.at(1)!;
				const id = item.version.id;
				const name = item.organisationalUnit.name;
				const countryId = item.organisationalUnit.id;

				const partnerInstitutionItems = createItems(1);
				await seedPartnerInstitutions(
					db,
					items[0]!.organisationalUnit.id,
					countryId,
					partnerInstitutionItems,
				);
				const partnerInstitution = partnerInstitutionItems[0]!;
				const coordinatingInstitutionItems = createItems(1);
				await seedPartnerInstitutions(
					db,
					items[0]!.organisationalUnit.id,
					countryId,
					coordinatingInstitutionItems,
					"is_national_coordinating_institution_in",
				);
				const coordinatingInstitution = coordinatingInstitutionItems[0]!;
				const representativeInstitutionItems = createItems(1);
				await seedPartnerInstitutions(
					db,
					items[0]!.organisationalUnit.id,
					countryId,
					representativeInstitutionItems,
					"is_national_representative_institution_in",
				);
				const representativeInstitution = representativeInstitutionItems[0]!;
				const contributorItems = createPersonItems(1);
				const contributor = await seedContributor(db, countryId, contributorItems);
				const contactContributorItems = createPersonItems(1);
				const contactContributor = await seedContributor(
					db,
					countryId,
					contactContributorItems,
					"is_contact_for",
				);
				const nationalConsortiumItems = createItems(1);
				const nationalConsortium = await seedNationalConsortium(
					db,
					countryId,
					nationalConsortiumItems,
				);

				const response = await client["members-partners"][":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as MemberOrPartner;

				assert(data.status !== "is_cooperating_partner_of");
				assert("description" in data);
				expect(data).toMatchObject({ name });
				// `is_national_coordinating_institution_in` and `is_national_representative_institution_in`
				// are surfaced as their own fields, not mixed into `institutions`.
				expect(data.institutions).toHaveLength(1);
				expect(data.institutions[0]).toMatchObject({
					name: partnerInstitution.organisationalUnit.name,
					slug: partnerInstitution.entity.slug,
					ror: null,
					website: null,
				});
				expect(data.nationalCoordinatingInstitution).toMatchObject({
					name: coordinatingInstitution.organisationalUnit.name,
					slug: coordinatingInstitution.entity.slug,
				});
				expect(data.nationalRepresentativeInstitution).toMatchObject({
					name: representativeInstitution.organisationalUnit.name,
					slug: representativeInstitution.entity.slug,
				});
				expect(data.contributors).toHaveLength(2);
				expect(data.contributors).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							id: contributor.person.id,
							name: contributor.person.name,
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							positions: expect.arrayContaining([
								expect.objectContaining({
									role: "is_affiliated_with",
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									entity: expect.objectContaining({
										label: contributor.affiliation.organisationalUnit.name,
									}),
								}),
								expect.objectContaining({
									role: "national_coordinator",
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									entity: expect.objectContaining({ label: item.organisationalUnit.name }),
								}),
							]),
							role: "national_coordinator",
						}),
						expect.objectContaining({
							id: contactContributor.person.id,
							name: contactContributor.person.name,
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							positions: expect.arrayContaining([
								expect.objectContaining({
									role: "is_affiliated_with",
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									entity: expect.objectContaining({
										label: contactContributor.affiliation.organisationalUnit.name,
									}),
								}),
								expect.objectContaining({
									role: "is_contact_for",
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									entity: expect.objectContaining({ label: item.organisationalUnit.name }),
								}),
							]),
							role: "is_contact_for",
						}),
					]),
				);
				expect(data.nationalConsortium).toMatchObject({
					name: nationalConsortium.organisationalUnit.name,
				});
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return ror for partner institutions", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const ror = "https://ror.org/05n09v162";

				// items[0] = ERIC, items[1] = member country
				const items = createItems(2);
				await seed(db, items);

				const ericItem = items[0]!;
				const countryItem = items[1]!;

				const institutionItems = createItems(1);
				await seedPartnerInstitutions(
					db,
					ericItem.organisationalUnit.id,
					countryItem.organisationalUnit.id,
					institutionItems,
				);
				const institution = institutionItems[0]!;

				await db
					.update(schema.organisationalUnits)
					.set({ ror })
					.where(eq(schema.organisationalUnits.id, institution.organisationalUnit.id));

				const response = await client["members-partners"][":id"].$get({
					param: { id: countryItem.version.id },
				});

				expect(response.status).toBe(200);

				const data = (await response.json()) as unknown as {
					institutions: Array<{ name: string; ror: string | null }>;
				};

				expect(data.institutions).toHaveLength(1);
				expect(data.institutions[0]).toMatchObject({
					name: institution.organisationalUnit.name,
					ror,
				});
			});
		});

		it("should prefer national consortium logo and non-empty description for member countries", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(2);
				const item = items.at(1)!;
				const countryDescription = createRichTextContent("Country description");
				const consortiumDescription = createRichTextContent("Consortium description");
				const consortiumAsset = createAsset("National consortium logo");
				await seed(db, items, new Map([[item.version.id, countryDescription]]));

				const [entityType] = await Promise.all([
					db.query.entityTypes.findFirst({
						columns: { id: true },
						where: { type: "organisational_units" },
					}),
					db.insert(schema.assets).values(consortiumAsset),
				]);

				assert(entityType);

				const nationalConsortium = await seedNationalConsortium(
					db,
					item.organisationalUnit.id,
					createItems(1),
				);

				await db
					.update(schema.organisationalUnits)
					.set({ imageId: consortiumAsset.id })
					.where(eq(schema.organisationalUnits.id, nationalConsortium.organisationalUnit.id));
				await db
					.update(schema.organisationalUnits)
					.set({ imageId: null })
					.where(eq(schema.organisationalUnits.id, item.organisationalUnit.id));

				await seedContentBlock(
					db,
					nationalConsortium.version.id,
					entityType.id,
					"description",
					consortiumDescription,
				);

				const detailResponse = await client["members-partners"][":id"].$get({
					param: { id: item.version.id },
				});
				const listResponse = await client["members-partners"].$get({
					query: { limit: "10", offset: "0" },
				});

				expect(detailResponse.status).toBe(200);
				expect(listResponse.status).toBe(200);

				const detailData = (await detailResponse.json()) as MemberOrPartner;
				const listData = (await listResponse.json()) as {
					data: Array<MemberOrPartnerBase>;
				};

				const listItem = listData.data.find((entry) => entry.id === item.version.id);
				assert(listItem);

				assert(detailData.status !== "is_cooperating_partner_of");
				expect(detailData.nationalConsortium?.image).not.toBeNull();
				expect(detailData.image).toEqual(detailData.nationalConsortium?.image);
				expect(listItem.image).not.toBeNull();
				expect(detailData.description).toEqual([
					{ type: "rich_text", content: consortiumDescription },
				]);
			});
		});

		it("should fall back to country description when national consortium description is empty", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(2);
				const item = items.at(1)!;
				const countryDescription = createRichTextContent("Country fallback description");
				await seed(db, items, new Map([[item.version.id, countryDescription]]));

				const entityType = await db.query.entityTypes.findFirst({
					columns: { id: true },
					where: { type: "organisational_units" },
				});

				assert(entityType);

				const nationalConsortium = await seedNationalConsortium(
					db,
					item.organisationalUnit.id,
					createItems(1),
				);

				await seedContentBlock(db, nationalConsortium.version.id, entityType.id, "description", {
					type: "doc",
					content: [],
				});

				const response = await client["members-partners"][":id"].$get({
					param: { id: item.version.id },
				});

				expect(response.status).toBe(200);

				const data = (await response.json()) as MemberOrPartner;

				expect(data.description).toEqual([{ type: "rich_text", content: countryDescription }]);
			});
		});

		it("should prefer national consortium related fields and social media for member countries", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(2);
				const item = items.at(1)!;
				await seed(db, items);

				const nationalConsortium = await seedNationalConsortium(
					db,
					item.organisationalUnit.id,
					createItems(1),
				);

				const countrySocialMedia = await seedSocialMedia(
					db,
					item.organisationalUnit.id,
					"mastodon",
					"https://social.example/country",
				);
				const consortiumSocialMedia = await seedSocialMedia(
					db,
					nationalConsortium.organisationalUnit.id,
					"mastodon",
					"https://social.example/consortium",
				);

				const countryRelatedPage = createRelatedPage();
				const consortiumRelatedPage = createRelatedPage();
				await seedRelatedPage(db, countryRelatedPage);
				await seedRelatedPage(db, consortiumRelatedPage);

				await db.insert(schema.entitiesToEntities).values([
					{ entityId: item.entity.id, relatedEntityId: countryRelatedPage.entity.id },
					{
						entityId: nationalConsortium.entity.id,
						relatedEntityId: consortiumRelatedPage.entity.id,
					},
				]);
				await db.insert(schema.entitiesToResources).values([
					{ entityId: item.entity.id, resourceId: "country-resource" },
					{ entityId: nationalConsortium.entity.id, resourceId: "consortium-resource" },
				]);

				const detailResponse = await client["members-partners"][":id"].$get({
					param: { id: item.version.id },
				});
				const slugResponse = await client["members-partners"].slugs[":slug"].$get({
					param: { slug: item.entity.slug },
					query: {},
				});
				const listResponse = await client["members-partners"].$get({
					query: { limit: "10", offset: "0" },
				});

				expect(detailResponse.status).toBe(200);
				expect(slugResponse.status).toBe(200);
				expect(listResponse.status).toBe(200);

				const detailData = (await detailResponse.json()) as MemberOrPartner;
				const slugData = (await slugResponse.json()) as MemberOrPartner;
				const listData = (await listResponse.json()) as { data: Array<MemberOrPartnerBase> };
				const listItem = listData.data.find((entry) => entry.id === item.version.id);
				assert(listItem);

				for (const data of [detailData, slugData]) {
					expect(data.socialMedia).toEqual([
						expect.objectContaining({
							id: consortiumSocialMedia.id,
							url: consortiumSocialMedia.url,
							type: consortiumSocialMedia.type,
						}),
					]);
					expect(data.socialMedia).not.toEqual([
						expect.objectContaining({ id: countrySocialMedia.id }),
					]);
					expect(data.relatedEntities).toEqual([
						expect.objectContaining({
							slug: consortiumRelatedPage.entity.slug,
							type: "pages",
							label: consortiumRelatedPage.page.title,
						}),
					]);
					expect(data.relatedResources).toEqual([
						expect.objectContaining({
							id: "consortium-resource",
							label: "Resource consortium-resource",
						}),
					]);
				}

				expect(listItem.socialMedia).toEqual([
					expect.objectContaining({
						id: consortiumSocialMedia.id,
						url: consortiumSocialMedia.url,
					}),
				]);
			});
		});

		it("should fall back to country related fields and social media when national consortium fields are empty", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(2);
				const item = items.at(1)!;
				await seed(db, items);

				await seedNationalConsortium(db, item.organisationalUnit.id, createItems(1));

				const countrySocialMedia = await seedSocialMedia(
					db,
					item.organisationalUnit.id,
					"mastodon",
					"https://social.example/country-fallback",
				);

				const countryRelatedPage = createRelatedPage();
				await seedRelatedPage(db, countryRelatedPage);

				await db.insert(schema.entitiesToEntities).values({
					entityId: item.entity.id,
					relatedEntityId: countryRelatedPage.entity.id,
				});
				await db.insert(schema.entitiesToResources).values({
					entityId: item.entity.id,
					resourceId: "country-fallback-resource",
				});

				const detailResponse = await client["members-partners"][":id"].$get({
					param: { id: item.version.id },
				});
				const listResponse = await client["members-partners"].$get({
					query: { limit: "10", offset: "0" },
				});

				expect(detailResponse.status).toBe(200);
				expect(listResponse.status).toBe(200);

				const detailData = (await detailResponse.json()) as MemberOrPartner;
				const listData = (await listResponse.json()) as { data: Array<MemberOrPartnerBase> };
				const listItem = listData.data.find((entry) => entry.id === item.version.id);
				assert(listItem);

				expect(detailData.socialMedia).toEqual([
					expect.objectContaining({
						id: countrySocialMedia.id,
						url: countrySocialMedia.url,
						type: countrySocialMedia.type,
					}),
				]);
				expect(detailData.relatedEntities).toEqual([
					expect.objectContaining({
						slug: countryRelatedPage.entity.slug,
						type: "pages",
						label: countryRelatedPage.page.title,
					}),
				]);
				expect(detailData.relatedResources).toEqual([
					expect.objectContaining({
						id: "country-fallback-resource",
						label: "Resource country-fallback-resource",
					}),
				]);
				expect(listItem.socialMedia).toEqual([
					expect.objectContaining({
						id: countrySocialMedia.id,
						url: countrySocialMedia.url,
					}),
				]);
			});
		});

		it("should return cooperating partner institutions in institutions", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const [status, entityType, defaultLocale] = await Promise.all([
					db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
					db.query.entityTypes.findFirst({
						columns: { id: true },
						where: { type: "organisational_units" },
					}),
					db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
				]);

				assert(status);
				assert(entityType);
				assert(defaultLocale);
				const localeId = defaultLocale.id;
				const umbrella = await getDariahEu(db);

				const partnerItems = createItems(2);
				await db.insert(schema.entities).values(
					partnerItems.map((entry) => {
						return {
							id: entry.entity.id,
							typeId: entityType.id,
						};
					}),
				);
				await db.insert(schema.entityVersions).values(
					partnerItems.map((entry) => {
						return {
							...entry.version,
							statusId: status.id,
							localeId,
						};
					}),
				);
				await db.insert(schema.slugs).values(
					partnerItems.map((entry) => {
						return {
							entityVersionId: entry.version.id,
							entityId: entry.entity.id,
							typeId: entityType.id,
							localeId,
							isPublished: true,
							value: entry.entity.slug,
						};
					}),
				);
				await seedCooperatingPartner(db, umbrella.versionId, partnerItems);

				const country = partnerItems[0]!;

				const response = await client["members-partners"][":id"].$get({
					param: {
						id: country.version.id,
					},
				});

				expect(response.status).toBe(200);

				const data = (await response.json()) as unknown as {
					status: string;
					institutions: Array<{
						name: string;
						slug: string;
						website: string | null;
					}>;
				};

				expect(data.status).toBe("is_cooperating_partner_of");
				expect(data.institutions).toHaveLength(1);
				expect(data.institutions[0]).toMatchObject({
					name: partnerItems[1]!.organisationalUnit.name,
					slug: partnerItems[1]!.entity.slug,
					website: null,
				});
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(5);
				await seed(db, items);

				const id = "no-uuid";

				const response = await client["members-partners"][":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(400);
			});
		});

		it("should return 404 for non-existing id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(5);
				await seed(db, items);

				const id = "019b75fd-6d6a-757c-acc2-c3c6266a0f31";

				const response = await client["members-partners"][":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/members-partners/slugs", () => {
		it("should return paginated list of slugs", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(5);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;

				const response = await client["members-partners"].slugs.$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length - 1);
				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ entity: { slug } })]),
				);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});
	});

	describe("GET /api/members-partners/slugs/:slug", () => {
		it("should return single member or partner", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(5);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;
				const name = item.organisationalUnit.name;
				const countryId = item.organisationalUnit.id;

				const partnerInstitutionItems = createItems(1);
				await seedPartnerInstitutions(
					db,
					items[0]!.organisationalUnit.id,
					countryId,
					partnerInstitutionItems,
				);
				const partnerInstitution = partnerInstitutionItems[0]!;
				const contributorItems = createPersonItems(1);
				const contributor = await seedContributor(db, countryId, contributorItems);
				const contactContributorItems = createPersonItems(1);
				const contactContributor = await seedContributor(
					db,
					countryId,
					contactContributorItems,
					"is_contact_for",
				);
				const staffContributorItems = createPersonItems(1);
				const staffContributor = await seedContributor(
					db,
					countryId,
					staffContributorItems,
					"national_coordination_staff",
				);
				const nationalConsortiumItems = createItems(1);
				const nationalConsortium = await seedNationalConsortium(
					db,
					countryId,
					nationalConsortiumItems,
				);

				const response = await client["members-partners"].slugs[":slug"].$get({
					param: {
						slug,
					},
					query: {},
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as MemberOrPartner;

				assert(data.status !== "is_cooperating_partner_of");
				assert("description" in data);
				expect(data).toMatchObject({ name });
				expect(data.institutions).toHaveLength(1);
				expect(data.institutions[0]).toMatchObject({
					name: partnerInstitution.organisationalUnit.name,
					slug: partnerInstitution.entity.slug,
					website: null,
				});
				expect(data.contributors).toHaveLength(3);
				expect(data.contributors).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							id: contributor.person.id,
							name: contributor.person.name,
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							positions: expect.arrayContaining([
								expect.objectContaining({
									role: "is_affiliated_with",
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									entity: expect.objectContaining({
										label: contributor.affiliation.organisationalUnit.name,
									}),
								}),
								expect.objectContaining({
									role: "national_coordinator",
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									entity: expect.objectContaining({ label: item.organisationalUnit.name }),
								}),
							]),
							role: "national_coordinator",
						}),
						expect.objectContaining({
							id: contactContributor.person.id,
							name: contactContributor.person.name,
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							positions: expect.arrayContaining([
								expect.objectContaining({
									role: "is_affiliated_with",
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									entity: expect.objectContaining({
										label: contactContributor.affiliation.organisationalUnit.name,
									}),
								}),
								expect.objectContaining({
									role: "is_contact_for",
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									entity: expect.objectContaining({ label: item.organisationalUnit.name }),
								}),
							]),
							role: "is_contact_for",
						}),
						expect.objectContaining({
							id: staffContributor.person.id,
							name: staffContributor.person.name,
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							positions: expect.arrayContaining([
								expect.objectContaining({
									role: "is_affiliated_with",
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									entity: expect.objectContaining({
										label: staffContributor.affiliation.organisationalUnit.name,
									}),
								}),
								expect.objectContaining({
									role: "national_coordination_staff",
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									entity: expect.objectContaining({ label: item.organisationalUnit.name }),
								}),
							]),
							role: "national_coordination_staff",
						}),
					]),
				);
				expect(data.nationalConsortium).toMatchObject({
					name: nationalConsortium.organisationalUnit.name,
				});
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 404 for non-existing slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(5);
				await seed(db, items);

				const slug = "non-existing-slug";

				const response = await client["members-partners"].slugs[":slug"].$get({
					param: {
						slug,
					},
					query: {},
				});

				expect(response.status).toBe(404);
			});
		});
	});
});
