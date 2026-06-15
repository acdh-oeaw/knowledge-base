import { appendFileSync } from "node:fs";

import { assert, groupBy, keyBy, log } from "@acdh-oeaw/lib";
import { type Transaction, createDatabaseService } from "@acdh-knowledge-base/database";
import * as schema from "@acdh-knowledge-base/database/schema";
import { type AssetMetadata, createStorageService } from "@acdh-knowledge-base/storage";
import { createStorageAdminService } from "@acdh-knowledge-base/storage/admin";
import { buffer } from "@acdh-knowledge-base/storage/lib";
import slugify from "@sindresorhus/slugify";
import { generateJSON } from "@tiptap/html";
import { StarterKit } from "@tiptap/starter-kit";
import { and, count, eq, ilike, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import { placeholderImageUrl } from "../config/data-migration.config";
import { env } from "../config/env.config";
import {
	countryToInstitution,
	roles,
	bodies as unrBodies,
	contributions as unrContributions,
	countries as unrCountries,
	countryToService as unrCountryToService,
	eventReports as unrEventReports,
	eventSizeValues as unrEventSizeValues,
	institutionToPerson as unrInstitutionToPerson,
	institutionService as unrInstitutionToService,
	institutions as unrInstitutions,
	outreach as unrOutreach,
	outreachKpis as unrOutreachKpis,
	outreachReports as unrOutreachReports,
	outreachTypeValues as unrOutreachTypeValues,
	persons as unrPersons,
	projects as unrProjects,
	reportCampaigns as unrReportingCampaigns,
	reports as unrReports,
	roleTypeValues as unrRoleTypeValues,
	serviceKpis as unrServiceKpis,
	serviceReports as unrServiceReports,
	serviceSizeValues as unrServiceSizeValues,
	services as unrServices,
	workingGroupEvents as unrWorkGroupEvents,
	workingGroupOutreach as unrWorkingGroupOutreach,
	workingGroupReports as unrWorkingGroupReports,
	workingGroups as unrWorkingGroups,
} from "../unr-schema/schema";

interface CampaignQuestionAnswer {
	question: string;
	answer: string;
	campaignId: string;
	workingGroupReportId: string;
}

interface CampaignQuestions {
	items: Array<CampaignQuestionAnswer>;
}

interface ReportComment {
	comments: string;
	contributions: string;
	institutions: string;
	eventReports: string;
	outreach: string;
	projectFundingLeverages: string;
	publications: string;
	serviceReports: string;
	software: string;
}

type ServiceSizeThreshold = Record<string, number>;

type ReportScreenCommentKey = (typeof schema.reportScreenCommentKeyEnum)[number];
type SocialMediaType = (typeof schema.socialMediaTypesEnum)[number];
type ReportingCampaignContributionAmountRoleType =
	(typeof schema.reportingCampaignContributionRoleEnum)[number];

const SOCIAL_MEDIA_DOMAINS: Record<SocialMediaType, Array<string>> = {
	bluesky: ["bsky.app"],
	twitter: ["twitter.com", "x.com"],
	facebook: ["facebook.com"],
	instagram: ["instagram.com"],
	linkedin: ["linkedin.com"],
	mastodon: ["mastodon.social"],
	vimeo: ["vimeo.com"],
	youtube: ["youtube.com", "youtu.be"],
	website: [],
	other: [],
};

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		user: env.DATABASE_USER,
	},
	logger: false,
}).unwrap();

/**
 * Relations, reports, the user actor, and service↔unit links are now keyed by document id
 * (`entities.id`). This import builds entity _version_ ids, so resolve a version id to its document
 * id before inserting into those tables.
 */
async function documentIdOf(tx: Transaction, versionId: string): Promise<string> {
	const [row] = await tx
		.select({ entityId: schema.entityVersions.entityId })
		.from(schema.entityVersions)
		.where(eq(schema.entityVersions.id, versionId))
		.limit(1);
	assert(row, `No entity version found for id "${versionId}".`);
	return row.entityId;
}

const storage = createStorageService({
	config: {
		accessKey: env.S3_ACCESS_KEY,
		bucketName: env.S3_BUCKET_NAME,
		endPoint: env.S3_HOST,
		port: env.S3_PORT,
		secretKey: env.S3_SECRET_KEY,
		useSSL: env.S3_PROTOCOL === "https",
	},
});

const storageAdmin = createStorageAdminService({
	config: {
		accessKey: env.S3_ACCESS_KEY,
		bucketName: env.S3_BUCKET_NAME,
		endPoint: env.S3_HOST,
		port: env.S3_PORT,
		secretKey: env.S3_SECRET_KEY,
		useSSL: env.S3_PROTOCOL === "https",
	},
});

const logToFile = (message: string, filepath = "migration.log") => {
	const timestamp = new Date().toISOString();
	const line = `[${timestamp}] ${message}\n`;
	appendFileSync(filepath, line);
};

const detectSocialMediaType = (url: string): SocialMediaType => {
	let hostname;
	try {
		hostname = new URL(url).hostname;
	} catch {
		hostname = url.toLowerCase();
	}
	for (const [type, domains] of Object.entries(SOCIAL_MEDIA_DOMAINS)) {
		if (domains.some((domain) => hostname.includes(domain))) {
			return type as SocialMediaType;
		}
	}

	return "other";
};

const unrDB = drizzle(env.UNR_DATABASE_DIRECT_URL);
const client = unrDB;

async function main() {
	const status = await db.query.entityStatus.findMany();
	const statusByType = keyBy(status, (item) => item.type);

	const types = await db.query.entityTypes.findMany();
	const typesByType = keyBy(types, (item) => item.type);

	const organisationalUnitTypes = await db.query.organisationalUnitTypes.findMany();
	const organisationalUnitTypesByType = keyBy(organisationalUnitTypes, (item) => item.type);

	const organisationalUnitStatus = await db.query.organisationalUnitStatus.findMany();
	const organisationalUnitStatusByType = keyBy(organisationalUnitStatus, (item) => item.status);

	const organisationalUnitServiceRoles = await db.query.organisationalUnitServiceRoles.findMany();
	const organisationalUnitServiceRolesByRole = keyBy(
		organisationalUnitServiceRoles,
		(item) => item.role,
	);

	const personRoleTypes = await db.query.personRoleTypes.findMany();
	const personRoleTypesByType = keyBy(personRoleTypes, (item) => item.type);

	const projectScopes = await db.query.projectScopes.findMany();
	const projectScopesByScope = keyBy(projectScopes, (item) => item.scope);

	const projectRoles = await db.query.projectRoles.findMany();
	const projectRolesByRole = keyBy(projectRoles, (item) => item.role);

	const entityTypes = await db.query.entityTypes.findMany();
	const entityTypesByType = keyBy(entityTypes, (item) => item.type);

	const contentBlockTypes = await db.query.contentBlockTypes.findMany();
	const contentBlockTypesByType = keyBy(contentBlockTypes, (item) => item.type);

	const serviceStatuses = await db.query.serviceStatuses.findMany();
	const serviceTypes = await db.query.serviceTypes.findMany();

	const socialMediaTypes = await db.query.socialMediaTypes.findMany();
	const socialMediaTypesByType = keyBy(socialMediaTypes, (item) => item.type);

	const bodies = await db.query.organisationalUnits.findMany({
		where: {
			typeId: organisationalUnitTypesByType.governance_body.id,
		},
	});

	const unrCountryIdToOrgUnitId = new Map<string, string>();
	const unrInstitutionIdToOrgUnitId = new Map<string, string>();
	const unrWorkingGroupIdToOrgUnitId = new Map<string, string>();
	const unrReportingCampaignIdToReportingCampaignId = new Map<string, string>();
	const unrReportIdToCountryReportId = new Map<string, string>();
	const unrServiceIdToServiceId = new Map<string, string>();
	const unrOutreachIdToSocialMediaId = new Map<string, string>();

	const placeholderInput = await buffer.fromUrl(placeholderImageUrl);
	const placeholderMetadata = await buffer.getMetadata(placeholderInput);

	const umbrellaUnit = await db.query.organisationalUnits.findFirst({
		where: {
			entityVersion: {
				entity: {
					slug: "dariah-eu",
				},
			},
			type: {
				type: "eric",
			},
		},
	});

	const { key: placeholderImage } = (
		await storage.upload({
			input: placeholderInput,
			prefix: "images",
			metadata: placeholderMetadata,
		})
	).unwrap();
	const [placeholderAsset] = await db
		.insert(schema.assets)
		.values({
			key: placeholderImage,
			label: "placeholder",
			mimeType: placeholderMetadata["content-type"],
		})
		.returning({ id: schema.assets.id });

	assert(placeholderAsset, "Missing placeholder image.");

	/**
	 * Migrates working groups from unr to knowledge base.
	 *
	 * For each working group:
	 *
	 * - Creates an entity in the entity table
	 * - Copies an existing logo from the old bucket to the new bucket
	 * - Creates an asset in the assets table
	 * - Creates an organisational unit of type working group
	 * - Updates the mapping between unr working groups and kb organisational units
	 * - Creates a relation between the organisational unit and the umbrella unit of type is_part_of
	 * - Creates a field in the fields table if a description exists
	 * - Creates a content block field realtion in the content blocks table
	 * - Creates a richtext content block for the description Checks if number of organisational units
	 *   of type working group in kb matches number of working groups in unr
	 */

	log.info("Migrating working groups...");

	const workingGroups = await client.select().from(unrWorkingGroups);

	for (const workingGroup of workingGroups) {
		await db.transaction(async (tx) => {
			const [entity] = await tx
				.insert(schema.entities)
				.values({
					slug: workingGroup.slug,
					typeId: typesByType.organisational_units.id,
					createdAt: new Date(workingGroup.createdAt),
					updatedAt: new Date(workingGroup.updatedAt),
				})
				.returning({ id: schema.entities.id });

			assert(entity);
			const [version] = await tx
				.insert(schema.entityVersions)
				.values({
					entityId: entity.id,
					statusId: statusByType.published.id,
				})
				.returning({ id: schema.entityVersions.id });
			assert(version);
			const id = version.id;
			let asset;

			if (workingGroup.logo != null) {
				let key: string;
				let metadata: AssetMetadata;

				try {
					({ key, metadata } = (
						await storageAdmin.buckets.copy({
							source: { bucket: env.UNR_S3_BUCKET_NAME, key: workingGroup.logo },
							prefix: "logos",
						})
					).unwrap());
					[asset] = await tx
						.insert(schema.assets)
						.values({
							key,
							label: workingGroup.name,
							mimeType: metadata["content-type"],
						})
						.returning({ id: schema.assets.id });
				} catch (error) {
					log.error(error);
				}
			}

			const [orgUnit] = await tx
				.insert(schema.organisationalUnits)
				.values({
					id,
					name: workingGroup.name,
					typeId: organisationalUnitTypesByType.working_group.id,
					metadata: {
						mailing_list: workingGroup.mailingList,
						member_tracking: workingGroup.memberTracking,
						contact_email: workingGroup.contactEmail,
					},
					sshocMarketplaceActorId: workingGroup.marketplaceId,
					summary: "",
					imageId: asset?.id ?? placeholderAsset.id,
					createdAt: workingGroup.createdAt,
					updatedAt: workingGroup.updatedAt,
				})
				.returning({ id: schema.organisationalUnits.id });

			assert(orgUnit);

			unrWorkingGroupIdToOrgUnitId.set(workingGroup.id, orgUnit.id);

			if (umbrellaUnit) {
				await tx.insert(schema.organisationalUnitsRelations).values({
					unitDocumentId: await documentIdOf(tx, orgUnit.id),
					relatedUnitDocumentId: await documentIdOf(tx, umbrellaUnit.id),
					duration: {
						start: workingGroup.startDate ?? new Date(Date.UTC(1900, 0, 1)),
						end: workingGroup.endDate ?? undefined,
					},
					status: organisationalUnitStatusByType.is_part_of.id,
				});
			}

			if (workingGroup.description == null) {
				return;
			}

			const content = generateJSON(workingGroup.description, [StarterKit]);

			const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
				where: {
					entityTypeId: entityTypesByType.organisational_units.id,
					fieldName: "description",
				},
			});

			assert(fieldName);

			const [field] = await tx
				.insert(schema.fields)
				.values({
					entityVersionId: version.id,
					fieldNameId: fieldName.id,
				})
				.returning({ id: schema.fields.id });

			assert(field);

			const [contentBlock] = await tx
				.insert(schema.contentBlocks)
				.values({
					position: 0,
					fieldId: field.id,
					typeId: contentBlockTypesByType.rich_text.id,
				})
				.returning({ id: schema.contentBlocks.id });

			assert(contentBlock);

			await tx.insert(schema.richTextContentBlocks).values({
				content,
				id: contentBlock.id,
			});
		});
	}

	const [workingGroupResult] = await db
		.select({ count: count() })
		.from(schema.organisationalUnits)
		.where(eq(schema.organisationalUnits.typeId, organisationalUnitTypesByType.working_group.id));
	assert(workingGroupResult?.count === workingGroups.length);

	/**
	 * Migrates countries from unr to knowledge base.
	 *
	 * For each country:
	 *
	 * - Creates an entity in the entity table
	 * - Creates an organisational unit of type country
	 * - Updates the mapping between unr countries and kb organisational units
	 * - Creates another entity in the entity table if the unr country has a consortium name
	 * - Copies an existing logo from the old bucket to the new bucket
	 * - Creates an asset in the assets table
	 * - Creates a field in the fields table if a description exists
	 * - Creates a content block field realtion in the content blocks table
	 * - Creates a richtext content block for the description
	 * - Creates an organisational unit of type national consortium if the unr country has a consortium
	 *   name
	 * - Creates a relation between the national consortium organisational unit and the country
	 *   organisitational unit of type: is_consortium_of
	 * - Creates a relation between the country organisational unit and the umbrella unit of type
	 *   is_member_of or is_cooperating_partner_of Checks if number of organisational units of type
	 *   country in kb matches number of countries in unr
	 */

	log.info("Migrating countries...");

	const countries = await client.select().from(unrCountries);

	for (const country of countries) {
		await db.transaction(async (tx) => {
			// create an entity for each country

			const [countryEntity] = await tx
				.insert(schema.entities)
				.values({
					slug: slugify(country.name),
					typeId: typesByType.organisational_units.id,
					createdAt: new Date(country.createdAt),
					updatedAt: new Date(country.updatedAt),
				})
				.returning({ id: schema.entities.id });

			assert(countryEntity);

			const [countryVersion] = await tx
				.insert(schema.entityVersions)
				.values({
					entityId: countryEntity.id,
					statusId: statusByType.published.id,
				})
				.returning({ id: schema.entityVersions.id });

			assert(countryVersion);
			const id = countryVersion.id;

			const [countryOrgUnit] = await tx
				.insert(schema.organisationalUnits)
				.values({
					id,
					acronym: country.code,
					name: country.name,
					summary: "",
					typeId: organisationalUnitTypesByType.country.id,
					imageId: placeholderAsset.id,
					createdAt: new Date(country.createdAt),
					updatedAt: new Date(country.createdAt),
				})
				.returning({ id: schema.organisationalUnits.id });

			assert(countryOrgUnit);

			unrCountryIdToOrgUnitId.set(country.id, countryOrgUnit.id);

			assert(umbrellaUnit);

			/* actors in the marketplace seem to be consortia,
			but not every country in the country table which has a marketplace id has a consortium name */

			// create an entity for each national consortium

			if (country.marketplaceId != null) {
				const [consortiumEntitiy] = await tx
					.insert(schema.entities)
					.values({
						slug: slugify(country.consortiumName ?? `Consortium ${country.name}`),
						typeId: typesByType.organisational_units.id,
						createdAt: new Date(country.createdAt),
						updatedAt: new Date(country.updatedAt),
					})
					.returning({ id: schema.entities.id });

				assert(consortiumEntitiy);

				const [consortiumVersion] = await tx
					.insert(schema.entityVersions)
					.values({
						entityId: consortiumEntitiy.id,
						statusId: statusByType.published.id,
					})
					.returning({ id: schema.entityVersions.id });

				assert(consortiumVersion);

				const id = consortiumVersion.id;
				let asset;

				if (country.logo != null) {
					let key: string;
					let metadata: AssetMetadata;

					try {
						({ key, metadata } = (
							await storageAdmin.buckets.copy({
								source: { bucket: env.UNR_S3_BUCKET_NAME, key: country.logo },
								prefix: "logos",
							})
						).unwrap());
						[asset] = await tx
							.insert(schema.assets)
							.values({
								key,
								label: country.name,
								mimeType: metadata["content-type"],
							})
							.returning({ id: schema.assets.id });
					} catch (error) {
						log.error(error);
					}
				}

				if (country.description != null) {
					const content = generateJSON(country.description, [StarterKit]);

					const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
						where: {
							entityTypeId: entityTypesByType.organisational_units.id,
							fieldName: "description",
						},
					});

					assert(fieldName);

					const [field] = await tx
						.insert(schema.fields)
						.values({
							entityVersionId: consortiumVersion.id,
							fieldNameId: fieldName.id,
						})
						.returning({ id: schema.fields.id });

					assert(field);

					const [contentBlock] = await tx
						.insert(schema.contentBlocks)
						.values({
							position: 0,
							fieldId: field.id,
							typeId: contentBlockTypesByType.rich_text.id,
						})
						.returning({ id: schema.contentBlocks.id });

					assert(contentBlock);

					await tx.insert(schema.richTextContentBlocks).values({
						content,
						id: contentBlock.id,
					});
				}

				// create an org unit for each national consortium

				const [consortiumOrgUnit] = await tx
					.insert(schema.organisationalUnits)
					.values({
						id,
						name: country.consortiumName ?? `Consortium ${country.name}`,
						sshocMarketplaceActorId: country.marketplaceId,
						summary: "",
						typeId: organisationalUnitTypesByType.national_consortium.id,
						imageId: asset?.id ?? placeholderAsset.id,
						createdAt: new Date(country.createdAt),
						updatedAt: new Date(country.createdAt),
					})
					.returning({ id: schema.organisationalUnits.id });

				assert(consortiumOrgUnit);

				// create a relationship between a country and consortium
				await tx.insert(schema.organisationalUnitsRelations).values({
					unitDocumentId: await documentIdOf(tx, consortiumOrgUnit.id),
					relatedUnitDocumentId: await documentIdOf(tx, countryOrgUnit.id),
					duration: { start: new Date(Date.UTC(1900, 0, 1)) },
					status: organisationalUnitStatusByType.is_national_consortium_of.id,
				});
			}

			// create a relationship between a country and eric

			if (country.type === "member_country") {
				await tx.insert(schema.organisationalUnitsRelations).values({
					unitDocumentId: await documentIdOf(tx, countryOrgUnit.id),
					relatedUnitDocumentId: await documentIdOf(tx, umbrellaUnit.id),
					duration: {
						start: country.startDate ?? new Date(Date.UTC(1900, 0, 1)),
						end: country.endDate ?? undefined,
					},
					status: organisationalUnitStatusByType.is_member_of.id,
				});
			}

			if (country.type === "cooperating_partnership") {
				await tx.insert(schema.organisationalUnitsRelations).values({
					unitDocumentId: await documentIdOf(tx, countryOrgUnit.id),
					relatedUnitDocumentId: await documentIdOf(tx, umbrellaUnit.id),
					duration: {
						start: country.startDate ?? new Date(Date.UTC(1900, 0, 1)),
						end: country.endDate ?? undefined,
					},
					status: organisationalUnitStatusByType.is_cooperating_partner_of.id,
				});
			}
		});
	}

	const [countryOrgUnitResult] = await db
		.select({ count: count() })
		.from(schema.organisationalUnits)
		.where(eq(schema.organisationalUnits.typeId, organisationalUnitTypesByType.country.id));
	assert(countryOrgUnitResult?.count === countries.length);

	/**
	 * Migrates institutions from unr to knowledge base.
	 *
	 * For each institution:
	 *
	 * - Creates an entity in the entity table
	 * - Creates an organisational unit of type institution
	 * - Updates the mapping between unr institutions and kb organisational units
	 * - Creates relations between the organisational unit and the umbrella unit of types:
	 *
	 *   - Is_cooperating_partner_of
	 *   - Is_national_coordinating_institution_in
	 *   - Is_national_representative_institution_in
	 *   - Is_partner_institution_of
	 * - Creates relation between the organisational unit and an organisational unit of type country of
	 *   type: is_located_in Checks if number of organisational units of type institution in kb
	 *   matches number of institutions in unr
	 */

	log.info("Migrating institutions...");

	const institutions = await client.select().from(unrInstitutions);
	assert(umbrellaUnit);

	const processedInstitutions = new Set<string>();

	for (const institution of institutions) {
		let slug = slugify(institution.name);
		if (processedInstitutions.has(slug)) {
			slug = `${slug}-duplicate`;
		}
		if (institution.name === "DARIAH-EU") {
			unrInstitutionIdToOrgUnitId.set(institution.id, umbrellaUnit.id);
		} else {
			await db.transaction(async (tx) => {
				const [entity] = await tx
					.insert(schema.entities)
					.values({
						slug,
						typeId: typesByType.organisational_units.id,
						createdAt: new Date(institution.createdAt),
						updatedAt: new Date(institution.createdAt),
					})
					.returning({ id: schema.entities.id });

				assert(entity);

				const [version] = await tx

					.insert(schema.entityVersions)

					.values({
						entityId: entity.id,

						statusId: statusByType.published.id,
					})

					.returning({ id: schema.entityVersions.id });

				assert(version);

				const id = version.id;

				const [orgUnit] = await tx
					.insert(schema.organisationalUnits)
					.values({
						id,
						name: institution.name,
						summary: "",
						typeId: organisationalUnitTypesByType.institution.id,
						ror: institution.ror,
						metadata: { url: institution.url },
						imageId: placeholderAsset.id,
						createdAt: new Date(institution.createdAt),
						updatedAt: new Date(institution.createdAt),
					})
					.returning({ id: schema.organisationalUnits.id });

				assert(orgUnit);

				unrInstitutionIdToOrgUnitId.set(institution.id, orgUnit.id);

				assert(umbrellaUnit);

				if (institution.types != null) {
					let institutionTypes = institution.types.filter((type) => type !== "other");

					institutionTypes =
						institutionTypes.includes("partner_institution") &&
						institutionTypes.some((t) =>
							[
								"national_coordinating_institution",
								"national_representative_institution",
								"cooperating_partner",
							].includes(t),
						)
							? institutionTypes.filter((t) => t !== "partner_institution")
							: institutionTypes;

					for (const type of institutionTypes) {
						if (type === "cooperating_partner") {
							await tx.insert(schema.organisationalUnitsRelations).values({
								unitDocumentId: await documentIdOf(tx, orgUnit.id),
								relatedUnitDocumentId: await documentIdOf(tx, umbrellaUnit.id),
								duration: {
									start: institution.startDate ?? new Date(Date.UTC(1900, 0, 1)),
									end: institution.endDate ?? undefined,
								},
								status: organisationalUnitStatusByType.is_cooperating_partner_of.id,
							});
						}
						if (type === "national_coordinating_institution") {
							await tx.insert(schema.organisationalUnitsRelations).values({
								unitDocumentId: await documentIdOf(tx, orgUnit.id),
								relatedUnitDocumentId: await documentIdOf(tx, umbrellaUnit.id),
								duration: {
									start: institution.startDate ?? new Date(Date.UTC(1900, 0, 1)),
									end: institution.endDate ?? undefined,
								},
								status: organisationalUnitStatusByType.is_national_coordinating_institution_in.id,
							});
						}
						if (type === "national_representative_institution") {
							await tx.insert(schema.organisationalUnitsRelations).values({
								unitDocumentId: await documentIdOf(tx, orgUnit.id),
								relatedUnitDocumentId: await documentIdOf(tx, umbrellaUnit.id),
								duration: {
									start: institution.startDate ?? new Date(Date.UTC(1900, 0, 1)),
									end: institution.endDate ?? undefined,
								},
								status: organisationalUnitStatusByType.is_national_representative_institution_in.id,
							});
						}
						if (type === "partner_institution") {
							await tx.insert(schema.organisationalUnitsRelations).values({
								unitDocumentId: await documentIdOf(tx, orgUnit.id),
								relatedUnitDocumentId: await documentIdOf(tx, umbrellaUnit.id),
								duration: {
									start: institution.startDate ?? new Date(Date.UTC(1900, 0, 1)),
									end: institution.endDate ?? undefined,
								},
								status: organisationalUnitStatusByType.is_partner_institution_of.id,
							});
						}
					}
				}
				const [countryOfInstitution] = await client
					.select({ countryId: countryToInstitution.a })
					.from(countryToInstitution)
					.where(eq(countryToInstitution.b, institution.id))
					.limit(1);

				if (countryOfInstitution?.countryId == null) {
					return;
				}

				const countryOrgaUnitId = unrCountryIdToOrgUnitId.get(countryOfInstitution.countryId);

				assert(countryOrgaUnitId);

				await tx.insert(schema.organisationalUnitsRelations).values({
					unitDocumentId: await documentIdOf(tx, orgUnit.id),
					relatedUnitDocumentId: await documentIdOf(tx, countryOrgaUnitId),
					duration: { start: new Date(Date.UTC(1900, 0, 1)) },
					status: organisationalUnitStatusByType.is_located_in.id,
				});
			});
		}
		processedInstitutions.add(slug);
	}

	const [institutionOrgUnitResult] = await db
		.select({ count: count() })
		.from(schema.organisationalUnits)
		.where(
			or(
				eq(schema.organisationalUnits.typeId, organisationalUnitTypesByType.institution.id),
				eq(schema.organisationalUnits.typeId, organisationalUnitTypesByType.eric.id),
			),
		);
	assert(institutionOrgUnitResult?.count === institutions.length);

	/**
	 * Migrates services from unr to knowledge base.
	 *
	 * For each service:
	 *
	 * - Creates a service
	 * - Updates the mapping between unr services and kb services
	 * - Creates relation between organisational unit of type institution and the service of types:
	 *
	 *   - Service_owner
	 *   - Service_provider
	 * - Creates relation between organisational unit of type country and the service of type:
	 *
	 *   - Service_provider Checks if number of services kb matches number of services in unr
	 */

	log.info("Migrating services...");

	const services = await client.select().from(unrServices);

	for (const service of services) {
		const unrServiceStatus = service.status === "in_preparation" ? "needs_review" : service.status;
		const serviceStatus = serviceStatuses.find((s) => s.status === unrServiceStatus);
		const serviceType = serviceTypes.find((t) => t.type === service.type);

		assert(serviceStatus);
		assert(serviceType);

		await db.transaction(async (tx) => {
			const [kbService] = await tx
				.insert(schema.services)
				.values({
					name: service.name,
					statusId: serviceStatus.id,
					typeId: serviceType.id,
					comment: service.comment,
					dariahBranding: service.dariahBranding,
					monitoring: service.monitoring,
					privateSupplier: service.privateSupplier,
					sshocMarketplaceId: service.marketplaceId,
					createdAt: new Date(service.createdAt),
					updatedAt: new Date(service.createdAt),
					metadata: {
						agreements: service.agreements,
						audience: service.audience,
						eosc_onboarding: service.eoscOnboarding,
						marketplace_status: service.marketplaceStatus,
						technical_contact: service.technicalContact,
						technical_readiness_level: service.technicalReadinessLevel,
						url: service.url,
						value_proposition: service.valueProposition,
					},
				})
				.returning({ id: schema.services.id });

			assert(kbService);

			unrServiceIdToServiceId.set(service.id, kbService.id);

			const [institutionOfService] = await client
				.select({
					institutionId: unrInstitutionToService.institutionId,
					role: unrInstitutionToService.role,
				})
				.from(unrInstitutionToService)
				.where(eq(unrInstitutionToService.serviceId, service.id))
				.limit(1);

			if (institutionOfService?.institutionId == null) {
				return;
			}

			const { institutionId, role: unrRole } = institutionOfService;

			const institutionOrgaUnitId = unrInstitutionIdToOrgUnitId.get(institutionId);
			const role = organisationalUnitServiceRoles.find((r) => r.role === unrRole);

			assert(institutionOrgaUnitId);
			assert(role);

			await tx.insert(schema.servicesToOrganisationalUnits).values({
				serviceId: kbService.id,
				organisationalUnitDocumentId: await documentIdOf(tx, institutionOrgaUnitId),
				roleId: role.id,
			});

			const [countryOfService] = await client
				.select({ countryId: unrCountryToService.a })
				.from(unrCountryToService)
				.where(eq(unrCountryToService.b, service.id))
				.limit(1);

			if (countryOfService?.countryId == null) {
				return;
			}

			const { countryId } = countryOfService;

			const countryOrgaUnitId = unrCountryIdToOrgUnitId.get(countryId);

			assert(countryOrgaUnitId);

			await tx.insert(schema.servicesToOrganisationalUnits).values({
				serviceId: kbService.id,
				organisationalUnitDocumentId: await documentIdOf(tx, countryOrgaUnitId),
				roleId: organisationalUnitServiceRolesByRole.service_provider.id,
			});
		});
	}

	const [serviceResult] = await db.select({ count: count() }).from(schema.services);
	assert(serviceResult?.count === services.length);

	/**
	 * Migrates reporting campaigns from unr to knowledge base.
	 *
	 * For each reporting campaign: - Creates a reporting campaign - Updates the mapping between unr
	 * reporting campaigns and kb reporting campaigns
	 */

	log.info("Migrating reprting campaigns...");

	const reportingCampaigns = await client.select().from(unrReportingCampaigns);

	for (const reportingCampaign of reportingCampaigns) {
		await db.transaction(async (tx) => {
			const [kbReportingCampaign] = await tx
				.insert(schema.reportingCampaigns)
				.values({
					year: reportingCampaign.year,
					status: "closed",
					createdAt: reportingCampaign.createdAt,
					updatedAt: reportingCampaign.updatedAt,
				})
				.returning({ id: schema.reportingCampaigns.id });

			assert(kbReportingCampaign);

			unrReportingCampaignIdToReportingCampaignId.set(reportingCampaign.id, kbReportingCampaign.id);
		});
	}

	/**
	 * Migrates outreach from unr to knowledge base.
	 *
	 * For each outreach item: - Creates a social media item either of type: - website - a dedicated
	 * social media type - other (if original type is social media but provider is one of the defined
	 * values) - Updates the mapping between unr outreach and kb social media - Creates relation
	 * between social media item and organisational unit of type country if provided in unr
	 */

	log.info("Migrating outreach...");

	const outreach = await client.select().from(unrOutreach);
	const outreachTypeValues = await client.select().from(unrOutreachTypeValues);
	const workingGroupOutreach = await client.select().from(unrWorkingGroupOutreach);

	for (const outreachItem of outreach) {
		let socialMediaType: SocialMediaType;
		const socialMediaUrl = outreachItem.url;
		switch (outreachItem.type) {
			case "national_website": {
				socialMediaType = "website";
				break;
			}
			case "national_social_media":
			case "social_media": {
				socialMediaType = detectSocialMediaType(socialMediaUrl);
				break;
			}
		}

		await db.transaction(async (tx) => {
			const [kbSocialMedia] = await tx
				.insert(schema.socialMedia)
				.values({
					name: outreachItem.name,
					typeId: socialMediaTypesByType[socialMediaType].id,
					url: outreachItem.url,
					duration: {
						start: outreachItem.startDate ?? new Date(Date.UTC(1900, 0, 1)),
						end: outreachItem.endDate ?? undefined,
					},
					createdAt: new Date(outreachItem.createdAt),
					updatedAt: new Date(outreachItem.createdAt),
				})
				.returning({ id: schema.socialMedia.id });

			assert(kbSocialMedia);

			unrOutreachIdToSocialMediaId.set(outreachItem.id, kbSocialMedia.id);

			if (outreachItem.countryId == null) {
				return;
			}

			const organisationalUnitId = unrCountryIdToOrgUnitId.get(outreachItem.countryId);

			if (organisationalUnitId == null) {
				return;
			}

			await tx.insert(schema.organisationalUnitsToSocialMedia).values({
				organisationalUnitId,
				socialMediaId: kbSocialMedia.id,
				createdAt: new Date(outreachItem.createdAt),
				updatedAt: new Date(outreachItem.createdAt),
			});
		});
	}

	/**
	 * Migrates working group outreach from unr to knowledge base.
	 *
	 * For each outreach item: - Creates a social media item either of type: - website - a dedicated
	 * social media type - other (if original type is social media but provider is one of the defined
	 * values) - Updates the mapping between unr working group outreach and kb social media - Creates
	 * relation between social media item and organisational unit of type country if provided in unr
	 */

	log.info("Migrating working group outreach...");

	for (const workingGroupOutreachItem of workingGroupOutreach) {
		let socialMediaType: SocialMediaType;
		const socialMediaUrl = workingGroupOutreachItem.url;

		switch (workingGroupOutreachItem.type) {
			case "social_media": {
				socialMediaType = detectSocialMediaType(socialMediaUrl);
				break;
			}
			case "website": {
				socialMediaType = "website";
			}
		}

		await db.transaction(async (tx) => {
			const [kbSocialMedia] = await tx
				.insert(schema.socialMedia)
				.values({
					name: workingGroupOutreachItem.name,
					typeId: socialMediaTypesByType[socialMediaType].id,
					url: workingGroupOutreachItem.url,
					duration: {
						start: workingGroupOutreachItem.startDate ?? new Date(Date.UTC(1900, 0, 1)),
						end: workingGroupOutreachItem.endDate ?? undefined,
					},
					createdAt: new Date(workingGroupOutreachItem.createdAt),
					updatedAt: new Date(workingGroupOutreachItem.createdAt),
				})
				.returning({ id: schema.services.id });

			assert(kbSocialMedia);

			unrOutreachIdToSocialMediaId.set(workingGroupOutreachItem.id, kbSocialMedia.id);

			const organisationalUnitId = unrWorkingGroupIdToOrgUnitId.get(
				workingGroupOutreachItem.workingGroupId,
			);

			if (organisationalUnitId == null) {
				return;
			}

			await tx.insert(schema.organisationalUnitsToSocialMedia).values({
				organisationalUnitId,
				socialMediaId: kbSocialMedia.id,
				createdAt: new Date(workingGroupOutreachItem.createdAt),
				updatedAt: new Date(workingGroupOutreachItem.createdAt),
			});
		});
	}

	/**
	 * Migrates outreach type values from unr to knowledge base.
	 *
	 * For each outreach type value: - Creates a reporting campaign social media amount either of
	 * type: - website - other
	 */

	log.info("Migrating outreach type values...");

	for (const outreachTypeValue of outreachTypeValues) {
		const campaignId = unrReportingCampaignIdToReportingCampaignId.get(
			outreachTypeValue.reportCampaignId,
		);
		assert(campaignId);
		const category = outreachTypeValue.type === "national_website" ? "website" : "other";
		const amount = category === "website" ? 5000 : 2000;
		await db
			.insert(schema.reportingCampaignSocialMediaAmounts)
			.values({
				campaignId,
				category,
				amount,
			})
			.onConflictDoNothing({
				target: [
					schema.reportingCampaignSocialMediaAmounts.campaignId,
					schema.reportingCampaignSocialMediaAmounts.category,
				],
			});
	}

	/**
	 * Migrates people from unr to knowledge base.
	 *
	 * For each person:
	 *
	 * - Creates an entity in the entity table
	 * - Copies an existing logo from the old bucket to the new bucket
	 * - Creates an asset in the assets table
	 * - Creates a field in the fields table if a biography exists
	 * - Creates a content block field realtion in the content blocks table
	 * - Creates a richtext content block for the biography
	 * - Creates relations between the person and organisational units of type institution of type:
	 *
	 *   - Is_affiliated_with
	 * - Creates relations between the person and organisational units either of type:
	 *
	 *   - Body: in roles is_member_of, is_chair_of
	 *   - Country: in roles national_coordinator, national_coordinator_deputy, national_representative,
	 *     national_representative_deputy"
	 *   - Working group: in roles is_member_of, is_chair_of
	 */

	log.info("Migrating people...");

	const people = await client.select().from(unrPersons);

	for (const person of people) {
		await db.transaction(async (tx) => {
			const [entity] = await tx
				.insert(schema.entities)
				.values({
					slug: slugify(person.name),
					typeId: typesByType.persons.id,
					createdAt: new Date(person.createdAt),
					updatedAt: new Date(person.updatedAt),
				})
				.returning({ id: schema.entities.id });

			assert(entity);

			const [version] = await tx

				.insert(schema.entityVersions)

				.values({
					entityId: entity.id,

					statusId: statusByType.published.id,
				})

				.returning({ id: schema.entityVersions.id });

			assert(version);

			const id = version.id;
			let asset;

			if (person.image != null) {
				let key: string;
				let metadata: AssetMetadata;

				try {
					({ key, metadata } = (
						await storageAdmin.buckets.copy({
							source: { bucket: env.UNR_S3_BUCKET_NAME, key: person.image },
							prefix: "avatars",
						})
					).unwrap());
					[asset] = await tx
						.insert(schema.assets)
						.values({
							key,
							label: person.name,
							mimeType: metadata["content-type"],
						})
						.returning({ id: schema.assets.id });
				} catch (error) {
					log.error(error);
				}
			}

			const [kbPerson] = await tx
				.insert(schema.persons)
				.values({
					id,
					name: person.name,
					sortName: person.name,
					email: person.email,
					orcid: person.orcid,
					imageId: asset?.id ?? placeholderAsset.id,
					createdAt: person.createdAt,
					updatedAt: person.updatedAt,
				})
				.returning({ id: schema.persons.id });

			if (person.description == null) {
				return;
			}

			const content = generateJSON(person.description, [StarterKit]);

			const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
				where: {
					entityTypeId: entityTypesByType.persons.id,
					fieldName: "biography",
				},
			});

			assert(fieldName);

			const [field] = await tx
				.insert(schema.fields)
				.values({
					entityVersionId: version.id,
					fieldNameId: fieldName.id,
				})
				.returning({ id: schema.fields.id });

			assert(field);

			const [contentBlock] = await tx
				.insert(schema.contentBlocks)
				.values({
					position: 0,
					fieldId: field.id,
					typeId: contentBlockTypesByType.rich_text.id,
				})
				.returning({ id: schema.contentBlocks.id });

			assert(contentBlock);

			await tx.insert(schema.richTextContentBlocks).values({
				content,
				id: contentBlock.id,
			});

			const institutionsOfPerson = await client
				.select({ institutionId: unrInstitutionToPerson.a })
				.from(unrInstitutionToPerson)
				.where(eq(unrInstitutionToPerson.b, person.id));

			assert(kbPerson);

			for (const institution of institutionsOfPerson) {
				const institutionOrgaUnitId = unrInstitutionIdToOrgUnitId.get(institution.institutionId);

				assert(institutionOrgaUnitId);

				await tx.insert(schema.personsToOrganisationalUnits).values({
					personDocumentId: await documentIdOf(tx, kbPerson.id),
					organisationalUnitDocumentId: await documentIdOf(tx, institutionOrgaUnitId),
					duration: { start: new Date(Date.UTC(1900, 0, 1)) },
					roleTypeId: personRoleTypesByType.is_affiliated_with.id,
				});
			}

			const contributionsByPerson = await client
				.select({
					countryId: unrContributions.countryId,
					personId: unrContributions.personId,
					workingGroupId: unrContributions.workingGroupId,
					startDate: unrContributions.startDate,
					endDate: unrContributions.endDate,
					role: roles.type,
				})
				.from(unrContributions)
				.leftJoin(roles, eq(unrContributions.roleId, roles.id))
				.where(eq(unrContributions.personId, person.id));

			for (const contributionByPerson of contributionsByPerson) {
				const { countryId, role, workingGroupId, startDate, endDate } = contributionByPerson;
				const countryOrgUnitId = countryId != null ? unrCountryIdToOrgUnitId.get(countryId) : null;
				const workingGroupOrgUnitId =
					workingGroupId != null ? unrWorkingGroupIdToOrgUnitId.get(workingGroupId) : null;
				let roleId;
				let relatedOrgaUnitId;

				switch (role) {
					case "national_coordinator":
					case "national_coordinator_deputy":
					case "national_representative":
					case "national_representative_deputy": {
						roleId = personRoleTypesByType[role].id;
						relatedOrgaUnitId = countryOrgUnitId;
						break;
					}
					case "wg_chair": {
						roleId = personRoleTypesByType.is_chair_of.id;
						relatedOrgaUnitId = workingGroupOrgUnitId;
						break;
					}
					case "wg_member": {
						roleId = personRoleTypesByType.is_member_of.id;
						relatedOrgaUnitId = workingGroupOrgUnitId;
						break;
					}
					case "smt_member": {
						roleId = personRoleTypesByType.is_member_of.id;
						relatedOrgaUnitId = bodies.find((b) => b.acronym === "smt")?.id;
						break;
					}
					case "scientific_board_member": {
						roleId = personRoleTypesByType.is_member_of.id;
						relatedOrgaUnitId = bodies.find((b) => b.acronym === "sab")?.id;
						break;
					}
					case "dco_member": {
						roleId = personRoleTypesByType.is_member_of.id;
						relatedOrgaUnitId = bodies.find((b) => b.acronym === "dco")?.id;
						break;
					}
					case "jrc_member": {
						roleId = personRoleTypesByType.is_member_of.id;
						relatedOrgaUnitId = bodies.find((b) => b.acronym === "jrc")?.id;
						break;
					}
					case "director": {
						roleId = personRoleTypesByType.is_member_of.id;
						relatedOrgaUnitId = bodies.find((b) => b.acronym === "bod")?.id;
						break;
					}
					case "jrc_chair": {
						roleId = personRoleTypesByType.is_chair_of.id;
						relatedOrgaUnitId = bodies.find((b) => b.acronym === "jrc")?.id;
						break;
					}
					case "ncc_chair": {
						roleId = personRoleTypesByType.is_chair_of.id;
						relatedOrgaUnitId = bodies.find((b) => b.acronym === "ncc")?.id;
						break;
					}
					case "national_consortium_contact":
					case "cooperating_partner_contact":
					case null: {
						break;
					}
				}

				assert(roleId);
				assert(relatedOrgaUnitId);

				await tx.insert(schema.personsToOrganisationalUnits).values({
					personDocumentId: await documentIdOf(tx, kbPerson.id),
					organisationalUnitDocumentId: await documentIdOf(tx, relatedOrgaUnitId),
					duration: {
						start: startDate ?? new Date(Date.UTC(1900, 0, 1)),
						end: endDate ?? undefined,
					},
					roleTypeId: roleId,
				});
			}
		});
	}

	/**
	 * Migrates bodies data from unr to knowledge base. Bodies are seeded per default
	 *
	 * For each body in unr: - Creates a field in the fields table if a description exists - Creates a
	 * content block field realtion in the content blocks table - Creates a richtext content block for
	 * the description
	 */

	log.info("Migrating bodies...");

	for (const body of bodies) {
		await db.transaction(async (tx) => {
			//  sb from unr changed to sab in kb
			const unrAcronym = body.acronym === "sab" ? "sb" : body.acronym;
			assert(unrAcronym);
			const [unrBody] = await client
				.select()
				.from(unrBodies)
				.where(ilike(unrBodies.acronym, unrAcronym));

			assert(unrBody);

			if (unrBody.description != null) {
				const content = generateJSON(unrBody.description, [StarterKit]);

				const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
					where: {
						entityTypeId: entityTypesByType.organisational_units.id,
						fieldName: "description",
					},
				});

				assert(fieldName);

				const [field] = await tx
					.insert(schema.fields)
					.values({
						entityVersionId: body.id,
						fieldNameId: fieldName.id,
					})
					.returning({ id: schema.fields.id });

				assert(field);

				const [contentBlock] = await tx
					.insert(schema.contentBlocks)
					.values({
						position: 0,
						fieldId: field.id,
						typeId: contentBlockTypesByType.rich_text.id,
					})
					.returning({ id: schema.contentBlocks.id });

				assert(contentBlock);

				await tx.insert(schema.richTextContentBlocks).values({
					content,
					id: contentBlock.id,
				});
			}
		});
	}

	/**
	 * Migrates role values from unr to knowledge base. For each role value in unr: - Creates a
	 * reporting campaign contribution amount
	 */

	log.info("Migrating role values...");

	const roleTypeValues = await client.select().from(unrRoleTypeValues);

	for (const roleTypeValue of roleTypeValues) {
		const campaignId = unrReportingCampaignIdToReportingCampaignId.get(
			roleTypeValue.reportCampaignId,
		);
		const amount = roleTypeValue.annualValue;
		let roleType: ReportingCampaignContributionAmountRoleType | null = null;
		const unrRoleType = roleTypeValue.type;

		switch (unrRoleType) {
			case "national_coordinator":
			case "national_coordinator_deputy": {
				roleType = unrRoleType;
				break;
			}
			case "jrc_member": {
				roleType = "is_member_of_jrc";
				break;
			}
			case "jrc_chair": {
				roleType = "is_chair_of_jrc";
				break;
			}
			case "ncc_chair": {
				roleType = "is_chair_of_ncc";
				break;
			}
			case "wg_chair": {
				roleType = "is_chair_of_wg";
				break;
			}
			case "national_representative":
			case "national_representative_deputy":
			case "dco_member":
			case "director":
			case "scientific_board_member":
			case "smt_member":
			case "wg_member":
			case "national_consortium_contact":
			case "cooperating_partner_contact": {
				break;
			}
		}

		assert(campaignId);

		if (roleType != null) {
			await db.transaction(async (tx) => {
				await tx.insert(schema.reportingCampaignContributionAmounts).values({
					campaignId,
					roleType,
					amount,
				});
			});
		}
	}

	/**
	 * Migrates event size values from unr to knowledge base. For each size value in unr: - Creates a
	 * reporting campaign event amount
	 */

	log.info("Migrating event size values...");

	const eventSizeValues = await client.select().from(unrEventSizeValues);

	for (const eventSizeValue of eventSizeValues) {
		const campaignId = unrReportingCampaignIdToReportingCampaignId.get(
			eventSizeValue.reportCampaignId,
		);
		const amount = eventSizeValue.annualValue;
		const eventType = eventSizeValue.type;

		assert(campaignId);
		await db.transaction(async (tx) => {
			await tx.insert(schema.reportingCampaignEventAmounts).values({
				campaignId,
				eventType,
				amount,
			});
		});
	}

	/**
	 * Migrates service size values from unr to knowledge base. * For each size value in unr: -
	 * Creates a reporting campaign service size
	 */

	log.info("Migrating service size values...");

	const serviceSizeValues = await client.select().from(unrServiceSizeValues);

	for (const serviceSizeValue of serviceSizeValues) {
		const campaignId = unrReportingCampaignIdToReportingCampaignId.get(
			serviceSizeValue.reportCampaignId,
		);
		assert(campaignId);
		const [unrReportingCampaign] = await client
			.select()
			.from(unrReportingCampaigns)
			.where(eq(unrReportingCampaigns.id, serviceSizeValue.reportCampaignId));
		const amount = serviceSizeValue.annualValue;
		const serviceSize = serviceSizeValue.type;
		const serviceSizeThresholds =
			unrReportingCampaign?.serviceSizeThresholds as ServiceSizeThreshold;
		const visitsThreshold = serviceSizeThresholds[serviceSize];

		await db.transaction(async (tx) => {
			await tx.insert(schema.reportingCampaignServiceSizes).values({
				campaignId,
				serviceSize,
				visitsThreshold,
				amount,
			});
		});
	}

	/**
	 * Migrates reports from unr to knowledge base. For each report in unr: - Creates a country report
	 * - Updates the mapping between unr reports and kb country reports - Creates reporting campaign
	 * country threshold - For each comment in a report: - Creates report screen key comment
	 */

	log.info("Migrating reports...");

	const reports = await client.select().from(unrReports);
	const outreachKpis = await client.select().from(unrOutreachKpis);
	const serviceKpis = await client.select().from(unrServiceKpis);
	const workingGroupReports = await client.select().from(unrWorkingGroupReports);

	for (const report of reports) {
		const campaignId = unrReportingCampaignIdToReportingCampaignId.get(report.reportCampaignId);
		const countryId = unrCountryIdToOrgUnitId.get(report.countryId);
		const [eventReports] = await client
			.select()
			.from(unrEventReports)
			.where(eq(unrEventReports.reportId, report.id));

		assert(campaignId);
		assert(countryId);

		await db.transaction(async (tx) => {
			const [countryReportId] = await tx
				.insert(schema.countryReports)
				.values({
					campaignId,
					countryDocumentId: await documentIdOf(tx, countryId),
					status: "accepted",
					dariahCommissionedEvent: eventReports?.dariahCommissionedEvent,
					smallEvents: eventReports?.smallMeetings,
					mediumEvents: eventReports?.mediumMeetings,
					largeEvents: eventReports?.largeMeetings,
					veryLargeEvents: eventReports?.veryLargeMeetings,
					totalContributors: report.contributionsCount,
					reusableOutcomes: eventReports?.reusableOutcomes,
					createdAt: report.createdAt,
					updatedAt: report.updatedAt,
				})
				.returning({ id: schema.countryReports.id });

			assert(countryReportId);

			unrReportIdToCountryReportId.set(report.id, countryReportId.id);

			await tx.insert(schema.reportingCampaignCountryThresholds).values({
				campaignId,
				countryDocumentId: await documentIdOf(tx, countryId),
				amount: Number(report.operationalCostThreshold),
			});

			if (report.comments != null) {
				for (const [k, v] of Object.entries(report.comments as ReportComment)) {
					let screenKey = k;
					switch (k) {
						case "outreach": {
							screenKey = "social-media";
							break;
						}
						case "contributions": {
							screenKey = "contributors";
							break;
						}
						case "eventReports": {
							screenKey = "events";
							break;
						}
						case "serviceReports": {
							screenKey = "services";
							break;
						}
						case "projectFundingLeverages": {
							screenKey = "projects";
						}
					}

					await tx.insert(schema.reportScreenComments).values({
						comment: generateJSON(String(v), [StarterKit]),
						reportType: "country",
						reportId: report.id,
						screenKey: screenKey as ReportScreenCommentKey,
						createdAt: report.createdAt,
						updatedAt: report.updatedAt,
					});
				}
			}
		});
	}

	/**
	 * Migrates service kpis from unr to knowledge base. For each service kpi in unr: - Creates a
	 * country report service kpi
	 */

	log.info("Migrating service kpis...");

	for (const serviceKpi of serviceKpis) {
		const [serviceReport] = await client
			.select()
			.from(unrServiceReports)
			.where(eq(unrServiceReports.id, serviceKpi.serviceReportId));
		assert(serviceReport);
		const countryReportId = unrReportIdToCountryReportId.get(serviceReport.reportId);
		assert(countryReportId);
		const serviceId = unrServiceIdToServiceId.get(serviceReport.serviceId);

		assert(serviceId);

		await db.transaction(async (tx) => {
			const [countryReportServiceKpi] = await tx
				.insert(schema.countryReportServiceKpis)
				.values({
					serviceId,
					countryReportId,
					kpi: serviceKpi.unit,
					value: serviceKpi.value,
				})
				.onConflictDoNothing({
					target: [
						schema.countryReportServiceKpis.countryReportId,
						schema.countryReportServiceKpis.serviceId,
						schema.countryReportServiceKpis.kpi,
					],
				})
				.returning({
					id: schema.countryReportServiceKpis.id,
				});
			if (!countryReportServiceKpi) {
				const [service] = await tx
					.select()
					.from(schema.services)
					.where(eq(schema.services.id, serviceId));
				assert(service);
				logToFile(`skipped duplicated entry ${serviceKpi.unit} for service ${service.name}.`);
			}
		});
	}

	/**
	 * Migrates outreach kpis from unr to knowledge base. For each outreach kpi in unr: - Creates a
	 * country report social media kpi
	 */

	log.info("Migrating outreach kpis...");

	for (const outreachKpi of outreachKpis) {
		const [outReachReport] = await client
			.select()
			.from(unrOutreachReports)
			.where(eq(unrOutreachReports.id, outreachKpi.outreachReportId));
		assert(outReachReport);
		const countryReportId = unrReportIdToCountryReportId.get(outReachReport.reportId);
		assert(countryReportId);
		const socialMediaId = unrOutreachIdToSocialMediaId.get(outReachReport.outreachId);
		assert(socialMediaId);

		await db.transaction(async (tx) => {
			const [countryReportSocialMediaKpi] = await tx
				.insert(schema.countryReportSocialMediaKpis)
				.values({
					socialMediaId,
					countryReportId,
					kpi: outreachKpi.unit === "mention" ? "mentions" : outreachKpi.unit,
					value: outreachKpi.value,
				})
				.onConflictDoNothing({
					target: [
						schema.countryReportSocialMediaKpis.countryReportId,
						schema.countryReportSocialMediaKpis.socialMediaId,
						schema.countryReportSocialMediaKpis.kpi,
					],
				})
				.returning({
					id: schema.countryReportSocialMediaKpis.id,
				});
			if (!countryReportSocialMediaKpi) {
				const [socialMedia] = await tx
					.select()
					.from(schema.socialMedia)
					.where(eq(schema.socialMedia.id, socialMediaId));
				assert(socialMedia);
				logToFile(`skipped duplicated entry ${outreachKpi.unit} for service ${socialMedia.name}.`);
			}
		});
	}

	/**
	 * Migrates working group reports from unr to knowledge base. For each report in unr:
	 *
	 * - Creates a working group report
	 * - For each question, answer in a report:
	 *
	 *   - Creates question, answer in working_group_report_questions and working_group_report_answers
	 * - For each comment in a report:
	 *
	 *   - Creates report screen key comment
	 * - For each working group event:
	 *
	 *   - Creates working group report event
	 */

	log.info("Migrating working group reports...");

	const workingGroupReportQAs: Array<CampaignQuestionAnswer> = [];

	for (const workingGroupReport of workingGroupReports) {
		const reportCampaignId = unrReportingCampaignIdToReportingCampaignId.get(
			workingGroupReport.reportCampaignId,
		);
		const workingGroupId = unrWorkingGroupIdToOrgUnitId.get(workingGroupReport.workingGroupId);

		assert(reportCampaignId);
		assert(workingGroupId);

		await db.transaction(async (tx) => {
			const [kbWorkingGroupReport] = await tx
				.insert(schema.workingGroupReports)
				.values({
					campaignId: reportCampaignId,
					workingGroupDocumentId: await documentIdOf(tx, workingGroupId),
					numberOfMembers: workingGroupReport.members,
					status: "accepted",
					createdAt: workingGroupReport.createdAt,
					updatedAt: workingGroupReport.updatedAt,
				})
				.returning({ id: schema.workingGroupReports.id });

			assert(kbWorkingGroupReport);

			const reportedQAs: Array<CampaignQuestionAnswer> = [
				...(workingGroupReport.narrativeQuestionsList as CampaignQuestions).items,
				...(workingGroupReport.facultativeQuestionsList as CampaignQuestions).items,
			];
			for (const reportedQA of reportedQAs) {
				workingGroupReportQAs.push({
					...reportedQA,
					campaignId: reportCampaignId,
					workingGroupReportId: kbWorkingGroupReport.id,
				});
			}

			if (workingGroupReport.comments != null) {
				for (const comment of Object.values(workingGroupReport.comments as ReportComment)) {
					await tx.insert(schema.reportScreenComments).values({
						comment: generateJSON(String(comment), [StarterKit]),
						reportType: "working_group",
						reportId: workingGroupReport.id,
						screenKey: "data",
						createdAt: workingGroupReport.createdAt,
						updatedAt: workingGroupReport.updatedAt,
					});
				}
			}
			const workingGroupReportEvents = await client
				.select()
				.from(unrWorkGroupEvents)
				.where(eq(unrWorkGroupEvents.reportId, workingGroupReport.id));
			for (const workingGroupReportEvent of workingGroupReportEvents) {
				await tx.insert(schema.workingGroupReportEvents).values({
					workingGroupReportId: kbWorkingGroupReport.id,
					title: workingGroupReportEvent.title,
					date: workingGroupReportEvent.date ?? new Date(Date.UTC(1900, 0, 1)),
					url: workingGroupReportEvent.url,
					role: workingGroupReportEvent.role,
				});
			}
		});
	}

	const workingGroupReportQAsGrouped = groupBy(
		workingGroupReportQAs,
		({ campaignId, question }) => `${campaignId}_${question}`,
	);
	let i = 0;
	for (const [_q, qas] of Object.entries(workingGroupReportQAsGrouped)) {
		assert(qas[0]);
		const campaignId = qas[0].campaignId;
		const question = qas[0].question;
		i++;
		await db.transaction(async (tx) => {
			const [wgReportQuestion]: Array<{ id: string }> = await tx
				.insert(schema.workingGroupReportQuestions)
				.values({
					campaignId,
					question: generateJSON(question, [StarterKit]),
					position: i,
				})
				.returning({ id: schema.workingGroupReportQuestions.id });

			assert(wgReportQuestion);

			for (const { workingGroupReportId, answer } of qas) {
				await tx
					.insert(schema.workingGroupReportAnswers)
					.values({
						questionId: wgReportQuestion.id,
						workingGroupReportId,
						answer: generateJSON(answer, [StarterKit]),
					})
					.returning({ id: schema.workingGroupReportAnswers.id });
			}
		});
	}

	/**
	 * Migrates project from unr to knowledge base. Projects are grouped by either acronym or title
	 * For each group: - Creates an entity in the entity table - Creates a project - For each funder:
	 * - Creates organisational unit of type institution - Creates a relation between the funding unit
	 * and the project - For each group item (project funding leverage): - Creates a country report
	 * project contribution
	 */

	log.info("Migrating projects...");

	const projects = await client.select().from(unrProjects);

	const groupedProjects = groupBy(projects, ({ acronym, name }) => acronym ?? name);

	for (const [projectName, projectLeverages] of Object.entries(groupedProjects)) {
		const createdAt = new Date(Date.now());

		await db.transaction(async (tx) => {
			let slug = slugify(projectName);
			// check if slug exists
			const [slugExists] = await tx
				.select()
				.from(schema.entities)
				.where(eq(schema.entities.slug, slug));
			if (slugExists) {
				slug = `${slug}-duplicate-${crypto.randomUUID()}`;
			}
			const [entity] = await tx
				.insert(schema.entities)
				.values({
					slug,
					typeId: typesByType.projects.id,
					createdAt,
					updatedAt: createdAt,
				})
				.returning({ id: schema.entities.id });

			assert(entity);

			const [version] = await tx
				.insert(schema.entityVersions)
				.values({
					entityId: entity.id,
					statusId: statusByType.published.id,
				})
				.returning({ id: schema.entityVersions.id });

			assert(version);

			const id = version.id;

			const startDates = [...new Set(projectLeverages.map((pL) => pL.startDate?.getTime()))]
				.toSorted((dateA = 0, dateB = 0) => dateA - dateB)
				.map((time) => (time != null ? new Date(time) : null))
				.filter((d) => d != null);

			const projectMonthsEntries = [...new Set(projectLeverages.map((pL) => pL.projectMonths))];

			if (startDates.length > 1) {
				logToFile(
					`multiple start dates found for project ${projectName}: ${startDates
						.map((startDate) => startDate.toISOString().slice(0, 10))
						.join(",")}. Chose ${String(startDates[0]?.toISOString().slice(0, 10))}`,
				);
			}
			if (projectMonthsEntries.length > 1) {
				logToFile(
					`multiple project months entries found for project ${projectName}: ${projectMonthsEntries
						.map((pM) => pM)
						.join(",")}. Chose ${String(projectMonthsEntries[0])}`,
				);
			}

			const startDate = startDates[0] ?? new Date(Date.UTC(1900, 0, 1));
			const projectMonths = projectMonthsEntries[0] ?? null;

			const endDate =
				projectMonths != null
					? new Date(
							new Date(startDate).setUTCMonth(new Date(startDate).getUTCMonth() + projectMonths),
						)
					: null;

			const projectScopes = [...new Set(projectLeverages.map((pL) => pL.scope))];

			const projectScope = projectScopes[0] ?? "national";

			const [kbProject] = await tx
				.insert(schema.projects)
				.values({
					id,
					acronym: projectLeverages[0]?.acronym,
					duration: {
						start: startDate,
						end: endDate ?? undefined,
					},
					scopeId: projectScopesByScope[projectScope].id,
					summary: "",
					name: projectName,
					createdAt,
					updatedAt: createdAt,
				})
				.returning({ id: schema.projects.id, duration: schema.projects.duration });

			assert(kbProject);

			const fundersEntries = projectLeverages.map((pL) => pL.funders);
			const funders = [
				...new Set(
					fundersEntries.flatMap((s) =>
						s != null ? s.split(";").map((v) => v.trim().replaceAll(/\s+/g, " ")) : [],
					),
				),
			];
			funders.filter((f) => f !== "Unknown");
			for (const funder of funders) {
				let [fundingUnit] = await tx
					.select({ id: schema.organisationalUnits.id })
					.from(schema.organisationalUnits)
					.where(
						and(
							eq(schema.organisationalUnits.name, funder),
							or(
								eq(schema.organisationalUnits.typeId, organisationalUnitTypesByType.institution.id),
								eq(
									schema.organisationalUnits.typeId,
									organisationalUnitTypesByType.national_consortium.id,
								),
							),
						),
					);
				if (!fundingUnit) {
					let slug = slugify(funder);
					// check if slug exists
					const [slugExists] = await tx
						.select()
						.from(schema.entities)
						.where(eq(schema.entities.slug, slug));
					if (slugExists) {
						slug = `${slug}-duplicate-${crypto.randomUUID()}`;
					}
					const [fundingUnitEntity] = await tx
						.insert(schema.entities)
						.values({
							slug,
							typeId: typesByType.organisational_units.id,
							createdAt,
							updatedAt: createdAt,
						})
						.returning({ id: schema.entities.id });

					assert(fundingUnitEntity);

					const [fundingUnitVersion] = await tx
						.insert(schema.entityVersions)
						.values({
							entityId: fundingUnitEntity.id,
							statusId: statusByType.published.id,
						})
						.returning({ id: schema.entityVersions.id });

					assert(fundingUnitVersion);

					const fundingUnitEntityId = fundingUnitVersion.id;

					[fundingUnit] = await tx
						.insert(schema.organisationalUnits)
						.values({
							id: fundingUnitEntityId,
							name: funder,
							summary: "",
							typeId: organisationalUnitTypesByType.institution.id,
							imageId: placeholderAsset.id,
							createdAt,
							updatedAt: createdAt,
						})
						.returning({ id: schema.organisationalUnits.id });
				}
				assert(fundingUnit);

				await tx.insert(schema.projectsToOrganisationalUnits).values({
					projectDocumentId: await documentIdOf(tx, kbProject.id),
					unitDocumentId: await documentIdOf(tx, fundingUnit.id),
					roleId: projectRolesByRole.funder.id,
					duration: kbProject.duration,
				});
			}
			for (const projectLeverage of projectLeverages) {
				const countryReportId = unrReportIdToCountryReportId.get(projectLeverage.reportId);
				assert(countryReportId);

				const [countryReportProjectContributionId] = await tx
					.insert(schema.countryReportProjectContributions)
					.values({
						projectDocumentId: await documentIdOf(tx, kbProject.id),
						amountEuros: Number(projectLeverage.amount),
						countryReportId,
					})
					.onConflictDoNothing({
						target: [
							schema.countryReportProjectContributions.projectDocumentId,
							schema.countryReportProjectContributions.countryReportId,
						],
					})
					.returning({
						id: schema.countryReportProjectContributions.id,
					});
				if (!countryReportProjectContributionId) {
					logToFile(`skipped duplicated entry for ${projectName}.`);
				}
			}
		});
	}
}

main()
	.catch((error: unknown) => {
		log.error("Failed to complete data migration.", error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises
	.finally(() =>
		// oxlint-disable-next-line typescript/strict-void-return
		db.$client.end().catch((error: unknown) => {
			log.error("Failed to close database connection.\n", error);
			process.exitCode = 1;
		}),
	);
