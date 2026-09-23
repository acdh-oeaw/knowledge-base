import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { join } from "node:path";

import { assert, log } from "@acdh-oeaw/lib";
import {
	type Database,
	type Transaction,
	createDatabaseService,
	plainTextToRichText,
} from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { eq, inArray, sql } from "@dariah-eric/database/sql";
import { type ResourceDocument, resourceSources, resourceTypes } from "@dariah-eric/search";
import { createSearchAdminService } from "@dariah-eric/search/admin";
import { createStorageService } from "@dariah-eric/storage";

import { env } from "../config/env.config";

type Db = Database | Transaction;

function createId(name: string): string {
	const hex = createHash("sha256").update(`kitchen-sink:${name}`).digest("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function createTimestampRange(start: string, end?: string | null) {
	return {
		start: new Date(start),
		end: end != null ? new Date(end) : undefined,
	};
}

function assertLookupId(value: string | undefined, message: string): string {
	if (value == null) {
		throw new Error(message);
	}

	return value;
}

const assetsDirectory = join(import.meta.dirname, "..", "assets", "kitchen-sink");

async function readKitchenSinkAsset(filename: string): Promise<Buffer> {
	return fs.readFile(join(assetsDirectory, filename));
}

async function uploadKitchenSinkAssets() {
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

	const [featuredImage, heroImage, avatarImage, documentPdf] = await Promise.all([
		readKitchenSinkAsset("featured-image.png"),
		readKitchenSinkAsset("hero-image.png"),
		readKitchenSinkAsset("avatar.png"),
		readKitchenSinkAsset("document.pdf"),
	]);

	const uploads = await Promise.all([
		storage
			.upload({
				input: featuredImage,
				metadata: { "content-type": "image/png", name: "featured-image.png" },
				prefix: "images",
				size: featuredImage.length,
			})
			.then((result) => result.unwrap()),
		storage
			.upload({
				input: heroImage,
				metadata: { "content-type": "image/png", name: "hero-image.png" },
				prefix: "images",
				size: heroImage.length,
			})
			.then((result) => result.unwrap()),
		storage
			.upload({
				input: avatarImage,
				metadata: { "content-type": "image/png", name: "avatar.png" },
				prefix: "avatars",
				size: avatarImage.length,
			})
			.then((result) => result.unwrap()),
		storage
			.upload({
				input: documentPdf,
				metadata: { "content-type": "application/pdf", name: "document.pdf" },
				prefix: "documents",
				size: documentPdf.length,
			})
			.then((result) => result.unwrap()),
	]);

	return {
		avatarKey: uploads[2].key,
		documentKey: uploads[3].key,
		featuredImageKey: uploads[0].key,
		heroImageKey: uploads[1].key,
	};
}

/* eslint-disable
	@typescript-eslint/no-explicit-any,
	@typescript-eslint/no-unsafe-assignment,
	@typescript-eslint/no-unsafe-member-access
*/
async function upsertById(
	db: Db,
	table: any,
	row: Record<string, unknown> & { id: string },
): Promise<void> {
	const { id: _id, ...set } = row;
	const targetTable = table;

	await db
		.insert(targetTable)
		.values(row as never)
		.onConflictDoUpdate({
			target: targetTable.id,
			set: set as never,
		});
}

async function upsertPublishedDocument(
	db: Db,
	row: { id: string; statusId: string; typeId: string; slug: string; versionId: string },
	localeId: string,
): Promise<{ documentId: string; versionId: string }> {
	const [document] = await db
		.insert(schema.entities)
		.values({
			id: row.id,
			typeId: row.typeId,
		})
		.onConflictDoUpdate({
			target: schema.entities.id,
			set: {
				updatedAt: new Date(),
			},
		})
		.returning({ id: schema.entities.id });

	if (document == null) {
		throw new Error(`Failed to upsert entity for type "${row.typeId}" and slug "${row.slug}".`);
	}

	const [version] = await db
		.insert(schema.entityVersions)
		.values({
			id: row.versionId,
			entityId: document.id,
			statusId: row.statusId,
			localeId,
		})
		.onConflictDoUpdate({
			target: [
				schema.entityVersions.entityId,
				schema.entityVersions.statusId,
				schema.entityVersions.localeId,
			],
			set: {
				updatedAt: new Date(),
			},
		})
		.returning({ id: schema.entityVersions.id });

	if (version == null) {
		throw new Error(`Failed to upsert published version for entity "${document.id}".`);
	}

	await db
		.insert(schema.slugs)
		.values({
			entityVersionId: version.id,
			entityId: document.id,
			typeId: row.typeId,
			localeId,
			isPublished: true,
			value: row.slug,
		})
		.onConflictDoUpdate({
			target: schema.slugs.entityVersionId,
			set: {
				value: row.slug,
				isPublished: true,
				updatedAt: new Date(),
			},
		});

	return { documentId: document.id, versionId: version.id };
}
/* eslint-enable
	@typescript-eslint/no-explicit-any,
	@typescript-eslint/no-unsafe-assignment,
	@typescript-eslint/no-unsafe-member-access
*/

async function ensureRelatedResources() {
	const search = createSearchAdminService({
		apiKey: env.TYPESENSE_ADMIN_API_KEY,
		nodes: [
			{
				host: env.TYPESENSE_HOST,
				port: env.TYPESENSE_PORT,
				protocol: env.TYPESENSE_PROTOCOL,
			},
		],
		collections: {
			resources: env.TYPESENSE_RESOURCE_COLLECTION_NAME,
			website: env.TYPESENSE_WEBSITE_COLLECTION_NAME,
		},
	});

	const createResult = await search.collections.resources.create();
	if (createResult.isErr()) {
		throw createResult.error;
	}

	const now = Math.floor(Date.now() / 1000);

	const documents: Array<ResourceDocument> = [
		{
			id: "kitchen-sink-resource-publication",
			source: resourceSources[2],
			source_id: "kitchen-sink-publication",
			source_updated_at: now,
			national_consortia: [],
			working_groups: [],
			institutions: [],
			upstream_sources: ["kitchen-sink-source"],
			imported_at: now,
			type: resourceTypes[0],
			label: "Kitchen Sink Publication",
			description: "A seeded publication resource for API integration testing.",
			keywords: ["kitchen-sink", "publication"],
			kind: "article",
			source_url: "https://example.org/resources/kitchen-sink-publication",
			links: ["https://example.org/external/kitchen-sink-publication"],
			authors: ["Kitchen Sink Author"],
			year: 2026,
			pid: "10.1234/kitchen-sink-publication",
		},
		{
			id: "kitchen-sink-resource-training-material",
			source: resourceSources[0],
			source_id: "kitchen-sink-training",
			source_updated_at: now,
			national_consortia: ["kitchen-sink-consortium"],
			working_groups: ["kitchen-sink-working-group"],
			institutions: ["kitchen-sink-institution"],
			upstream_sources: ["kitchen-sink-upstream"],
			imported_at: now,
			type: resourceTypes[3],
			label: "Kitchen Sink Training Material",
			description: "A seeded training material resource for API integration testing.",
			keywords: ["kitchen-sink", "training"],
			kind: null,
			source_url: "https://example.org/resources/kitchen-sink-training",
			links: ["https://example.org/external/kitchen-sink-training"],
			authors: ["Kitchen Sink Trainer"],
			year: 2026,
			pid: null,
		},
	];

	for (const document of documents) {
		const result = await search.collections.resources.upsert(document);
		if (result.isErr()) {
			throw result.error;
		}
	}

	return documents.map((document) => document.id);
}

async function main() {
	const db = createDatabaseService({
		connection: {
			database: env.DATABASE_NAME,
			host: env.DATABASE_HOST,
			password: env.DATABASE_PASSWORD,
			port: env.DATABASE_PORT,
			ssl: env.DATABASE_SSL_CONNECTION === "enabled",
			user: env.DATABASE_USER,
			max: 1,
		},
		logger: true,
	}).unwrap();

	try {
		const resourceIds = await ensureRelatedResources();
		const uploadedAssets = await uploadKitchenSinkAssets();

		await db.transaction(async (tx) => {
			const [
				entityTypeRows,
				entityStatusRows,
				unitTypeRows,
				unitStatusRows,
				personRoleRows,
				projectRoleRows,
				projectScopeRows,
				projectCallRows,
				opportunitySourceRows,
				socialMediaTypeRows,
				serviceTypeRows,
				serviceStatusRows,
				organisationalUnitServiceRoleRows,
				contentBlockTypeRows,
				dataContentBlockTypeRows,
				licenseRows,
				fieldNameRows,
				localeRows,
			] = await Promise.all([
				tx.select().from(schema.entityTypes),
				tx.select().from(schema.entityStatus),
				tx.select().from(schema.organisationalUnitTypes),
				tx.select().from(schema.organisationalUnitStatus),
				tx.select().from(schema.personRoleTypes),
				tx.select().from(schema.projectRoles),
				tx.select().from(schema.projectScopes),
				tx.select().from(schema.projectCalls),
				tx.select().from(schema.opportunitySources),
				tx.select().from(schema.socialMediaTypes),
				tx.select().from(schema.serviceTypes),
				tx.select().from(schema.serviceStatuses),
				tx.select().from(schema.organisationalUnitServiceRoles),
				tx.select().from(schema.contentBlockTypes),
				tx.select().from(schema.dataContentBlockTypes),
				tx.select().from(schema.licenses),
				tx
					.select({
						id: schema.entityTypesFieldsNames.id,
						entityTypeId: schema.entityTypesFieldsNames.entityTypeId,
						fieldName: schema.entityTypesFieldsNames.fieldName,
					})
					.from(schema.entityTypesFieldsNames),
				tx.select().from(schema.locales),
			]);

			const defaultLocaleId = assertLookupId(
				localeRows.find((row) => row.isDefault)?.id,
				"Missing default locale. Seed locales before running this script.",
			);

			const entityTypeIds = new Map(entityTypeRows.map((row) => [row.type, row.id]));
			const entityStatusIds = new Map(entityStatusRows.map((row) => [row.type, row.id]));
			const unitTypeIds = new Map(unitTypeRows.map((row) => [row.type, row.id]));
			const unitStatusIds = new Map(unitStatusRows.map((row) => [row.status, row.id]));
			const personRoleIds = new Map(personRoleRows.map((row) => [row.type, row.id]));
			const projectRoleIds = new Map(projectRoleRows.map((row) => [row.role, row.id]));
			const projectScopeIds = new Map(projectScopeRows.map((row) => [row.scope, row.id]));
			const projectCallIds = new Map(projectCallRows.map((row) => [row.call, row.id]));
			const opportunitySourceIds = new Map(
				opportunitySourceRows.map((row) => [row.source, row.id]),
			);
			const socialMediaTypeIds = new Map(socialMediaTypeRows.map((row) => [row.type, row.id]));
			const serviceTypeIds = new Map(serviceTypeRows.map((row) => [row.type, row.id]));
			const serviceStatusIds = new Map(serviceStatusRows.map((row) => [row.status, row.id]));
			const organisationalUnitServiceRoleIds = new Map(
				organisationalUnitServiceRoleRows.map((row) => [row.role, row.id]),
			);
			const contentBlockTypeIds = new Map(contentBlockTypeRows.map((row) => [row.type, row.id]));
			const dataContentBlockTypeIds = new Map(
				dataContentBlockTypeRows.map((row) => [row.type, row.id]),
			);
			const licenseId = licenseRows[0]?.id;

			if (licenseId == null) {
				throw new Error("No license rows found. Seed lookup data before running this script.");
			}

			const publishedStatusId = assertLookupId(
				entityStatusIds.get("published"),
				'Missing entity status "published".',
			);

			const entityTypeFieldNames = new Map<string, Array<{ id: string; fieldName: string }>>();
			for (const row of fieldNameRows) {
				const items = entityTypeFieldNames.get(row.entityTypeId) ?? [];
				items.push({ id: row.id, fieldName: row.fieldName });
				entityTypeFieldNames.set(row.entityTypeId, items);
			}

			const assets = [
				{
					id: createId("asset:image"),
					key: uploadedAssets.featuredImageKey,
					label: "Kitchen Sink Featured Image",
					filename: "featured-image.png",
					mimeType: "image/png",
					caption: plainTextToRichText("Kitchen sink featured image."),
					alt: "Kitchen sink featured illustration",
					licenseId,
				},
				{
					id: createId("asset:hero-image"),
					key: uploadedAssets.heroImageKey,
					label: "Kitchen Sink Hero Image",
					filename: "hero-image.png",
					mimeType: "image/png",
					caption: plainTextToRichText("Kitchen sink hero image."),
					alt: "Kitchen sink hero illustration",
					licenseId,
				},
				{
					id: createId("asset:avatar"),
					key: uploadedAssets.avatarKey,
					label: "Kitchen Sink Avatar",
					filename: "avatar.png",
					mimeType: "image/png",
					caption: plainTextToRichText("Kitchen sink avatar."),
					alt: "Kitchen sink avatar portrait",
					licenseId,
				},
				{
					id: createId("asset:document"),
					key: uploadedAssets.documentKey,
					label: "Kitchen Sink Document",
					filename: "document.pdf",
					mimeType: "application/pdf",
					caption: plainTextToRichText("Kitchen sink policy PDF."),
					alt: "Kitchen sink policy PDF",
					licenseId,
				},
			];

			for (const asset of assets) {
				await upsertById(tx, schema.assets, asset);
			}

			await upsertById(tx, schema.documentPolicyGroups, {
				id: createId("document-policy-group"),
				label: "Kitchen Sink Policies",
				position: 1,
			});

			const projectDocument = {
				id: createId("entity:project"),
				versionId: createId("version:project"),
			};
			const dariahEricDocument = {
				id: createId("entity:eric"),
				versionId: createId("version:eric"),
			};
			const workingGroupDocument = {
				id: createId("entity:working-group"),
				versionId: createId("version:working-group"),
			};
			const secondWorkingGroupDocument = {
				id: createId("entity:working-group:second"),
				versionId: createId("version:working-group:second"),
			};
			const governanceBodyDocument = {
				id: createId("entity:governance-body"),
				versionId: createId("version:governance-body"),
			};
			const memberCountryDocument = {
				id: createId("entity:country"),
				versionId: createId("version:country"),
			};
			const secondMemberCountryDocument = {
				id: createId("entity:country:second"),
				versionId: createId("version:country:second"),
			};
			const institutionDocument = {
				id: createId("entity:institution"),
				versionId: createId("version:institution"),
			};
			const coordinatingInstitutionDocument = {
				id: createId("entity:institution:coordinating"),
				versionId: createId("version:institution:coordinating"),
			};
			const representativeInstitutionDocument = {
				id: createId("entity:institution:representative"),
				versionId: createId("version:institution:representative"),
			};
			const consortiumDocument = {
				id: createId("entity:national-consortium"),
				versionId: createId("version:national-consortium"),
			};
			const kitchenSinkPersonDocument = {
				id: createId("entity:person:kitchen-sink"),
				versionId: createId("version:person:kitchen-sink"),
			};
			const relatedPersonDocument = {
				id: createId("entity:person:related"),
				versionId: createId("version:person:related"),
			};
			const eventDocument = {
				id: createId("entity:event:kitchen-sink"),
				versionId: createId("version:event:kitchen-sink"),
			};
			const prevEventDocument = {
				id: createId("entity:event:previous"),
				versionId: createId("version:event:previous"),
			};
			const nextEventDocument = {
				id: createId("entity:event:next"),
				versionId: createId("version:event:next"),
			};
			const pageDocument = { id: createId("entity:page"), versionId: createId("version:page") };
			const newsDocument = { id: createId("entity:news"), versionId: createId("version:news") };
			/**
			 * Extra published news items so the featured-news-items e2e test has enough options. Titles
			 * are distinct and non-prefixing (no one is a substring of another) so Playwright's
			 * substring-based role locators stay unambiguous, and they sort before "Kitchen Sink News".
			 */
			const featuredNewsDocuments = [
				{ slug: "featured-test-news-alpha", title: "Featured Test News Alpha" },
				{ slug: "featured-test-news-bravo", title: "Featured Test News Bravo" },
				{ slug: "featured-test-news-charlie", title: "Featured Test News Charlie" },
				{ slug: "featured-test-news-delta", title: "Featured Test News Delta" },
			].map((entry) => {
				return {
					...entry,
					id: createId(`entity:news:${entry.slug}`),
					versionId: createId(`version:news:${entry.slug}`),
				};
			});
			/**
			 * Extra published events so the featured-events e2e test has enough options. Same naming
			 * discipline as `featuredNewsDocuments` (distinct, non-prefixing titles that sort before the
			 * "Kitchen Sink" events) so the picker's first page and Playwright's role locators stay
			 * unambiguous.
			 */
			const featuredEventDocuments = [
				{ slug: "featured-test-event-alpha", title: "Featured Test Event Alpha" },
				{ slug: "featured-test-event-bravo", title: "Featured Test Event Bravo" },
				{ slug: "featured-test-event-charlie", title: "Featured Test Event Charlie" },
				{ slug: "featured-test-event-delta", title: "Featured Test Event Delta" },
			].map((entry) => {
				return {
					...entry,
					id: createId(`entity:event:${entry.slug}`),
					versionId: createId(`version:event:${entry.slug}`),
				};
			});
			/**
			 * Extra published projects so the featured-projects e2e test has enough options. Same naming
			 * discipline as `featuredNewsDocuments`/`featuredEventDocuments` (distinct, non-prefixing
			 * titles that sort before "Kitchen Sink Project") so the picker's first page and Playwright's
			 * role locators stay unambiguous.
			 */
			const featuredProjectDocuments = [
				{ slug: "featured-test-project-alpha", title: "Featured Test Project Alpha" },
				{ slug: "featured-test-project-bravo", title: "Featured Test Project Bravo" },
				{ slug: "featured-test-project-charlie", title: "Featured Test Project Charlie" },
				{ slug: "featured-test-project-delta", title: "Featured Test Project Delta" },
			].map((entry) => {
				return {
					...entry,
					id: createId(`entity:project:${entry.slug}`),
					versionId: createId(`version:project:${entry.slug}`),
				};
			});
			const fundingCallDocument = {
				id: createId("entity:funding-call"),
				versionId: createId("version:funding-call"),
			};
			const opportunityDocument = {
				id: createId("entity:opportunity"),
				versionId: createId("version:opportunity"),
			};
			const spotlightDocument = {
				id: createId("entity:spotlight"),
				versionId: createId("version:spotlight"),
			};
			const impactDocument = {
				id: createId("entity:impact"),
				versionId: createId("version:impact"),
			};
			const documentPolicyDocument = {
				id: createId("entity:document-policy"),
				versionId: createId("version:document-policy"),
			};

			const entities = [
				{
					id: projectDocument.id,
					versionId: projectDocument.versionId,
					typeId: assertLookupId(entityTypeIds.get("projects"), 'Missing entity type "projects".'),
					statusId: publishedStatusId,
					slug: "kitchen-sink",
				},
				{
					id: dariahEricDocument.id,
					versionId: dariahEricDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("organisational_units"),
						'Missing entity type "organisational_units".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink-eric",
				},
				{
					id: workingGroupDocument.id,
					versionId: workingGroupDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("organisational_units"),
						'Missing entity type "organisational_units".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink-working-group",
				},
				{
					id: secondWorkingGroupDocument.id,
					versionId: secondWorkingGroupDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("organisational_units"),
						'Missing entity type "organisational_units".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink-working-group-two",
				},
				{
					id: governanceBodyDocument.id,
					versionId: governanceBodyDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("organisational_units"),
						'Missing entity type "organisational_units".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink-governance-body",
				},
				{
					id: memberCountryDocument.id,
					versionId: memberCountryDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("organisational_units"),
						'Missing entity type "organisational_units".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink-country",
				},
				{
					id: secondMemberCountryDocument.id,
					versionId: secondMemberCountryDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("organisational_units"),
						'Missing entity type "organisational_units".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink-country-two",
				},
				{
					id: institutionDocument.id,
					versionId: institutionDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("organisational_units"),
						'Missing entity type "organisational_units".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink-institution",
				},
				{
					id: coordinatingInstitutionDocument.id,
					versionId: coordinatingInstitutionDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("organisational_units"),
						'Missing entity type "organisational_units".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink-coordinating-institution",
				},
				{
					id: representativeInstitutionDocument.id,
					versionId: representativeInstitutionDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("organisational_units"),
						'Missing entity type "organisational_units".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink-representative-institution",
				},
				{
					id: consortiumDocument.id,
					versionId: consortiumDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("organisational_units"),
						'Missing entity type "organisational_units".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink-national-consortium",
				},
				{
					id: kitchenSinkPersonDocument.id,
					versionId: kitchenSinkPersonDocument.versionId,
					typeId: assertLookupId(entityTypeIds.get("persons"), 'Missing entity type "persons".'),
					statusId: publishedStatusId,
					slug: "kitchen-sink",
				},
				{
					id: relatedPersonDocument.id,
					versionId: relatedPersonDocument.versionId,
					typeId: assertLookupId(entityTypeIds.get("persons"), 'Missing entity type "persons".'),
					statusId: publishedStatusId,
					slug: "kitchen-sink-related-person",
				},
				{
					id: eventDocument.id,
					versionId: eventDocument.versionId,
					typeId: assertLookupId(entityTypeIds.get("events"), 'Missing entity type "events".'),
					statusId: publishedStatusId,
					slug: "kitchen-sink",
				},
				{
					id: prevEventDocument.id,
					versionId: prevEventDocument.versionId,
					typeId: assertLookupId(entityTypeIds.get("events"), 'Missing entity type "events".'),
					statusId: publishedStatusId,
					slug: "kitchen-sink-previous",
				},
				{
					id: nextEventDocument.id,
					versionId: nextEventDocument.versionId,
					typeId: assertLookupId(entityTypeIds.get("events"), 'Missing entity type "events".'),
					statusId: publishedStatusId,
					slug: "kitchen-sink-next",
				},
				{
					id: pageDocument.id,
					versionId: pageDocument.versionId,
					typeId: assertLookupId(entityTypeIds.get("pages"), 'Missing entity type "pages".'),
					statusId: publishedStatusId,
					slug: "kitchen-sink",
				},
				{
					id: newsDocument.id,
					versionId: newsDocument.versionId,
					typeId: assertLookupId(entityTypeIds.get("news"), 'Missing entity type "news".'),
					statusId: publishedStatusId,
					slug: "kitchen-sink",
				},
				{
					id: fundingCallDocument.id,
					versionId: fundingCallDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("funding_calls"),
						'Missing entity type "funding_calls".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink",
				},
				{
					id: opportunityDocument.id,
					versionId: opportunityDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("opportunities"),
						'Missing entity type "opportunities".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink",
				},
				{
					id: spotlightDocument.id,
					versionId: spotlightDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("spotlight_articles"),
						'Missing entity type "spotlight_articles".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink",
				},
				{
					id: impactDocument.id,
					versionId: impactDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("impact_case_studies"),
						'Missing entity type "impact_case_studies".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink",
				},
				{
					id: documentPolicyDocument.id,
					versionId: documentPolicyDocument.versionId,
					typeId: assertLookupId(
						entityTypeIds.get("documents_policies"),
						'Missing entity type "documents_policies".',
					),
					statusId: publishedStatusId,
					slug: "kitchen-sink",
				},
				...featuredNewsDocuments.map((doc) => {
					return {
						id: doc.id,
						versionId: doc.versionId,
						typeId: assertLookupId(entityTypeIds.get("news"), 'Missing entity type "news".'),
						statusId: publishedStatusId,
						slug: doc.slug,
					};
				}),
				...featuredEventDocuments.map((doc) => {
					return {
						id: doc.id,
						versionId: doc.versionId,
						typeId: assertLookupId(entityTypeIds.get("events"), 'Missing entity type "events".'),
						statusId: publishedStatusId,
						slug: doc.slug,
					};
				}),
				...featuredProjectDocuments.map((doc) => {
					return {
						id: doc.id,
						versionId: doc.versionId,
						typeId: assertLookupId(
							entityTypeIds.get("projects"),
							'Missing entity type "projects".',
						),
						statusId: publishedStatusId,
						slug: doc.slug,
					};
				}),
			];

			const entityIdsBySeedId = new Map<string, { documentId: string; versionId: string }>();

			for (const entity of entities) {
				const document = await upsertPublishedDocument(tx, entity, defaultLocaleId);
				entityIdsBySeedId.set(entity.id, document);
			}

			const projectEntityId = entityIdsBySeedId.get(projectDocument.id)!.documentId;
			const projectVersionId = entityIdsBySeedId.get(projectDocument.id)!.versionId;
			const dariahEricVersionId = entityIdsBySeedId.get(dariahEricDocument.id)!.versionId;
			const dariahEricEntityId = entityIdsBySeedId.get(dariahEricDocument.id)!.documentId;
			const workingGroupEntityId = entityIdsBySeedId.get(workingGroupDocument.id)!.documentId;
			const workingGroupVersionId = entityIdsBySeedId.get(workingGroupDocument.id)!.versionId;
			const secondWorkingGroupEntityId = entityIdsBySeedId.get(
				secondWorkingGroupDocument.id,
			)!.documentId;
			const secondWorkingGroupVersionId = entityIdsBySeedId.get(
				secondWorkingGroupDocument.id,
			)!.versionId;
			const governanceBodyEntityId = entityIdsBySeedId.get(governanceBodyDocument.id)!.documentId;
			const governanceBodyVersionId = entityIdsBySeedId.get(governanceBodyDocument.id)!.versionId;
			const memberCountryEntityId = entityIdsBySeedId.get(memberCountryDocument.id)!.documentId;
			const memberCountryVersionId = entityIdsBySeedId.get(memberCountryDocument.id)!.versionId;
			const secondMemberCountryVersionId = entityIdsBySeedId.get(
				secondMemberCountryDocument.id,
			)!.versionId;
			const institutionVersionId = entityIdsBySeedId.get(institutionDocument.id)!.versionId;
			const institutionEntityId = entityIdsBySeedId.get(institutionDocument.id)!.documentId;
			const coordinatingInstitutionVersionId = entityIdsBySeedId.get(
				coordinatingInstitutionDocument.id,
			)!.versionId;
			const coordinatingInstitutionEntityId = entityIdsBySeedId.get(
				coordinatingInstitutionDocument.id,
			)!.documentId;
			const representativeInstitutionVersionId = entityIdsBySeedId.get(
				representativeInstitutionDocument.id,
			)!.versionId;
			const representativeInstitutionEntityId = entityIdsBySeedId.get(
				representativeInstitutionDocument.id,
			)!.documentId;
			const consortiumVersionId = entityIdsBySeedId.get(consortiumDocument.id)!.versionId;
			const consortiumEntityId = entityIdsBySeedId.get(consortiumDocument.id)!.documentId;
			const kitchenSinkPersonEntityId = entityIdsBySeedId.get(
				kitchenSinkPersonDocument.id,
			)!.documentId;
			const kitchenSinkPersonVersionId = entityIdsBySeedId.get(
				kitchenSinkPersonDocument.id,
			)!.versionId;
			const relatedPersonVersionId = entityIdsBySeedId.get(relatedPersonDocument.id)!.versionId;
			const relatedPersonEntityId = entityIdsBySeedId.get(relatedPersonDocument.id)!.documentId;
			const eventEntityId = entityIdsBySeedId.get(eventDocument.id)!.documentId;
			const eventVersionId = entityIdsBySeedId.get(eventDocument.id)!.versionId;
			const prevEventVersionId = entityIdsBySeedId.get(prevEventDocument.id)!.versionId;
			const nextEventVersionId = entityIdsBySeedId.get(nextEventDocument.id)!.versionId;
			const pageEntityId = entityIdsBySeedId.get(pageDocument.id)!.documentId;
			const pageVersionId = entityIdsBySeedId.get(pageDocument.id)!.versionId;
			const newsEntityId = entityIdsBySeedId.get(newsDocument.id)!.documentId;
			const newsVersionId = entityIdsBySeedId.get(newsDocument.id)!.versionId;
			const fundingCallEntityId = entityIdsBySeedId.get(fundingCallDocument.id)!.documentId;
			const fundingCallVersionId = entityIdsBySeedId.get(fundingCallDocument.id)!.versionId;
			const opportunityEntityId = entityIdsBySeedId.get(opportunityDocument.id)!.documentId;
			const opportunityVersionId = entityIdsBySeedId.get(opportunityDocument.id)!.versionId;
			const spotlightEntityId = entityIdsBySeedId.get(spotlightDocument.id)!.documentId;
			const spotlightVersionId = entityIdsBySeedId.get(spotlightDocument.id)!.versionId;
			const impactEntityId = entityIdsBySeedId.get(impactDocument.id)!.documentId;
			const impactVersionId = entityIdsBySeedId.get(impactDocument.id)!.versionId;
			const documentPolicyVersionId = entityIdsBySeedId.get(documentPolicyDocument.id)!.versionId;

			await upsertById(tx, schema.persons, {
				id: kitchenSinkPersonVersionId,
				name: "Kitchen Sink Person",
				sortName: "Person, Kitchen Sink",
				email: "kitchen.sink.person@example.org",
				orcid: "0000-0002-1825-0097",
				imageId: createId("asset:avatar"),
			});
			await upsertById(tx, schema.persons, {
				id: relatedPersonVersionId,
				name: "Related Kitchen Sink Person",
				sortName: "Person, Related Kitchen Sink",
				email: "related.person@example.org",
				orcid: "0000-0002-1694-233X",
				imageId: createId("asset:avatar"),
			});

			await upsertById(tx, schema.events, {
				id: prevEventVersionId,
				title: "Kitchen Sink Previous Event",
				summary: "A previous event so the by-slug endpoint exposes `links.prev`.",
				imageId: createId("asset:image"),
				location: "Vienna",
				duration: createTimestampRange("2026-03-01T09:00:00.000Z", "2026-03-01T17:00:00.000Z"),
				isFullDay: false,
				website: "https://example.org/events/kitchen-sink-previous",
			});
			await upsertById(tx, schema.events, {
				id: eventVersionId,
				title: "Kitchen Sink Event",
				summary: "An event with every exposed API field populated.",
				imageId: createId("asset:image"),
				location: "Vienna",
				duration: createTimestampRange("2026-04-15T09:00:00.000Z", "2026-04-17T17:00:00.000Z"),
				isFullDay: false,
				website: "https://example.org/events/kitchen-sink",
			});
			await upsertById(tx, schema.events, {
				id: nextEventVersionId,
				title: "Kitchen Sink Next Event",
				summary: "A later event so the by-slug endpoint exposes `links.next`.",
				imageId: createId("asset:image"),
				location: "Berlin",
				duration: createTimestampRange("2026-05-10T09:00:00.000Z", "2026-05-10T17:00:00.000Z"),
				isFullDay: false,
				website: "https://example.org/events/kitchen-sink-next",
			});

			await upsertById(tx, schema.pages, {
				id: pageVersionId,
				title: "Kitchen Sink Page",
				summary: "A page seeded for API contract testing.",
				publicationDate: new Date("2024-01-15T00:00:00.000Z"),
				imageId: createId("asset:image"),
			});
			await upsertById(tx, schema.news, {
				id: newsVersionId,
				title: "Kitchen Sink News",
				summary: "A news item seeded for API contract testing.",
				publicationDate: new Date("2024-01-15T00:00:00.000Z"),
				imageId: createId("asset:image"),
			});
			for (const doc of featuredNewsDocuments) {
				await upsertById(tx, schema.news, {
					id: entityIdsBySeedId.get(doc.id)!.versionId,
					title: doc.title,
					summary: "A published news item seeded for the featured-items e2e tests.",
					publicationDate: new Date("2024-01-15T00:00:00.000Z"),
					imageId: createId("asset:image"),
				});
			}
			for (const doc of featuredEventDocuments) {
				await upsertById(tx, schema.events, {
					id: entityIdsBySeedId.get(doc.id)!.versionId,
					title: doc.title,
					summary: "A published event seeded for the featured-items e2e tests.",
					imageId: createId("asset:image"),
					location: "Vienna",
					duration: createTimestampRange("2026-04-15T09:00:00.000Z", "2026-04-17T17:00:00.000Z"),
					isFullDay: false,
					website: `https://example.org/events/${doc.slug}`,
				});
			}
			await upsertById(tx, schema.fundingCalls, {
				id: fundingCallVersionId,
				title: "Kitchen Sink Funding Call",
				summary: "A funding call seeded for API contract testing.",
				duration: createTimestampRange("2026-06-01T00:00:00.000Z", "2026-06-30T23:59:59.000Z"),
				imageId: createId("asset:image"),
			});
			await upsertById(tx, schema.opportunities, {
				id: opportunityVersionId,
				title: "Kitchen Sink Opportunity",
				summary: "An opportunity seeded for API contract testing.",
				duration: createTimestampRange("2026-07-01T00:00:00.000Z", "2026-07-31T23:59:59.000Z"),
				sourceId: assertLookupId(
					opportunitySourceIds.get("dariah"),
					'Missing opportunity source "dariah".',
				),
				website: "https://example.org/opportunities/kitchen-sink",
				imageId: createId("asset:image"),
			});
			await upsertById(tx, schema.spotlightArticles, {
				id: spotlightVersionId,
				title: "Kitchen Sink Spotlight Article",
				summary: "A spotlight article seeded for API contract testing.",
				publicationDate: new Date("2024-01-15T00:00:00.000Z"),
				imageId: createId("asset:image"),
			});
			await upsertById(tx, schema.impactCaseStudies, {
				id: impactVersionId,
				title: "Kitchen Sink Impact Case Study",
				summary: "An impact case study seeded for API contract testing.",
				publicationDate: new Date("2024-01-15T00:00:00.000Z"),
				imageId: createId("asset:image"),
			});
			await upsertById(tx, schema.documentsPolicies, {
				id: documentPolicyVersionId,
				title: "Kitchen Sink Policy",
				summary: "A document or policy seeded for API contract testing.",
				url: "https://example.org/documents/kitchen-sink-policy",
				documentId: createId("asset:document"),
				groupId: createId("document-policy-group"),
				position: 1,
			});

			await upsertById(tx, schema.organisationalUnits, {
				id: dariahEricVersionId,
				name: "Kitchen Sink ERIC",
				acronym: "KS-ERIC",
				summary:
					"Support organisational unit for DARIAH project, working group, and membership relations.",
				metadata: { region: "Europe" },
				imageId: createId("asset:image"),
				typeId: assertLookupId(unitTypeIds.get("eric"), 'Missing organisational unit type "eric".'),
				sshocMarketplaceActorId: 9001,
			});
			await upsertById(tx, schema.organisationalUnits, {
				id: workingGroupVersionId,
				name: "Kitchen Sink Working Group",
				acronym: "KSWG",
				summary: "A working group with all fields, chairs, relations, and resources populated.",
				metadata: {
					activities: "Testing and validation",
					disciplines: "Digital humanities",
					memberTracking: "https://example.org/member-tracking",
					mailingList: "kitchen-sink-working-group@example.org",
					contactEmail: "kitchen-sink-working-group@example.org",
				},
				imageId: createId("asset:image"),
				typeId: assertLookupId(
					unitTypeIds.get("working_group"),
					'Missing organisational unit type "working_group".',
				),
				sshocMarketplaceActorId: 9002,
			});
			await upsertById(tx, schema.organisationalUnits, {
				id: secondWorkingGroupVersionId,
				name: "Kitchen Sink Working Group Two",
				acronym: "KSWG2",
				summary: "A second working group for testing users who chair multiple groups.",
				metadata: {
					activities: "Multi-group authorization testing",
					disciplines: "Digital humanities",
					mailingList: "kitchen-sink-working-group-two@example.org",
					contactEmail: "kitchen-sink-working-group-two@example.org",
				},
				imageId: createId("asset:image"),
				typeId: assertLookupId(
					unitTypeIds.get("working_group"),
					'Missing organisational unit type "working_group".',
				),
				sshocMarketplaceActorId: 9007,
			});
			await upsertById(tx, schema.organisationalUnits, {
				id: governanceBodyVersionId,
				name: "Kitchen Sink Governance Body",
				acronym: "KSGB",
				summary: "A governance body with persons, relations, and social media populated.",
				metadata: { mandate: "Integration oversight" },
				imageId: createId("asset:image"),
				typeId: assertLookupId(
					unitTypeIds.get("governance_body"),
					'Missing organisational unit type "governance_body".',
				),
				sshocMarketplaceActorId: 9003,
			});
			await upsertById(tx, schema.organisationalUnits, {
				id: memberCountryVersionId,
				name: "Kitchen Sink Country",
				acronym: "KSC",
				summary: "A member country with contributors, institutions, and consortium populated.",
				metadata: { isoCode: "KS", continent: "Europe" },
				imageId: createId("asset:image"),
				typeId: assertLookupId(
					unitTypeIds.get("country"),
					'Missing organisational unit type "country".',
				),
				sshocMarketplaceActorId: 9004,
			});
			await upsertById(tx, schema.organisationalUnits, {
				id: secondMemberCountryVersionId,
				name: "Kitchen Sink Country Two",
				acronym: "KSC2",
				summary: "A second member country for testing cross-tenant report authorization.",
				metadata: { isoCode: "K2", continent: "Europe" },
				imageId: createId("asset:image"),
				typeId: assertLookupId(
					unitTypeIds.get("country"),
					'Missing organisational unit type "country".',
				),
				sshocMarketplaceActorId: 9008,
			});
			await upsertById(tx, schema.organisationalUnits, {
				id: institutionVersionId,
				name: "Kitchen Sink Institution",
				acronym: "KSI",
				summary: "An institution linked to the member country and ERIC for endpoint hydration.",
				metadata: { city: "Vienna" },
				imageId: createId("asset:image"),
				typeId: assertLookupId(
					unitTypeIds.get("institution"),
					'Missing organisational unit type "institution".',
				),
				sshocMarketplaceActorId: 9005,
			});
			await upsertById(tx, schema.organisationalUnits, {
				id: coordinatingInstitutionVersionId,
				name: "Kitchen Sink Coordinating Institution",
				acronym: "KSCI",
				summary: "The national coordinating institution of the member country in the ERIC.",
				metadata: { city: "Vienna" },
				imageId: createId("asset:image"),
				typeId: assertLookupId(
					unitTypeIds.get("institution"),
					'Missing organisational unit type "institution".',
				),
				sshocMarketplaceActorId: 9008,
			});
			await upsertById(tx, schema.organisationalUnits, {
				id: representativeInstitutionVersionId,
				name: "Kitchen Sink Representative Institution",
				acronym: "KSRI",
				summary: "The national representative institution of the member country in the ERIC.",
				metadata: { city: "Vienna" },
				imageId: createId("asset:image"),
				typeId: assertLookupId(
					unitTypeIds.get("institution"),
					'Missing organisational unit type "institution".',
				),
				sshocMarketplaceActorId: 9009,
			});
			await upsertById(tx, schema.organisationalUnits, {
				id: consortiumVersionId,
				name: "Kitchen Sink National Consortium",
				acronym: "KSNC",
				summary: "A national consortium linked to the member country.",
				metadata: { scope: "National coordination" },
				imageId: createId("asset:image"),
				typeId: assertLookupId(
					unitTypeIds.get("national_consortium"),
					'Missing organisational unit type "national_consortium".',
				),
				sshocMarketplaceActorId: 9006,
			});

			await upsertById(tx, schema.projects, {
				id: projectVersionId,
				metadata: { programme: "Horizon Europe", contract: "KS-2026-001" },
				name: "Kitchen Sink Project",
				acronym: "KSP",
				duration: createTimestampRange("2025-01-01T00:00:00.000Z", "2027-12-31T23:59:59.000Z"),
				funding: 1_234_567.89,
				summary:
					"A project that also qualifies as a DARIAH project and exercises all API relations.",
				callId: assertLookupId(
					projectCallIds.get("go_digital_3_0"),
					'Missing project call "go_digital_3_0".',
				),
				topic: "Interoperability and integration testing",
				imageId: createId("asset:image"),
				scopeId: assertLookupId(projectScopeIds.get("eu"), 'Missing project scope "eu".'),
			});
			for (const doc of featuredProjectDocuments) {
				await upsertById(tx, schema.projects, {
					id: entityIdsBySeedId.get(doc.id)!.versionId,
					name: doc.title,
					summary: "A published project seeded for the featured-items e2e tests.",
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", "2027-12-31T23:59:59.000Z"),
					imageId: createId("asset:image"),
					scopeId: assertLookupId(projectScopeIds.get("eu"), 'Missing project scope "eu".'),
				});
			}

			const socialMediaRows = [
				{
					id: createId("social-media:website"),
					name: "Kitchen Sink Website",
					url: "https://example.org/kitchen-sink",
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
					typeId: assertLookupId(
						socialMediaTypeIds.get("website"),
						'Missing social media type "website".',
					),
				},
				{
					id: createId("social-media:linkedin"),
					name: "Kitchen Sink LinkedIn",
					url: "https://www.linkedin.com/company/kitchen-sink",
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
					typeId: assertLookupId(
						socialMediaTypeIds.get("linkedin"),
						'Missing social media type "linkedin".',
					),
				},
				{
					id: createId("social-media:mastodon"),
					name: "Kitchen Sink Mastodon",
					url: "https://social.example/@kitchen-sink",
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
					typeId: assertLookupId(
						socialMediaTypeIds.get("mastodon"),
						'Missing social media type "mastodon".',
					),
				},
			];

			for (const row of socialMediaRows) {
				await upsertById(tx, schema.socialMedia, row);
			}

			await upsertById(tx, schema.projectsToSocialMedia, {
				id: createId("project-social:website"),
				projectId: projectVersionId,
				socialMediaId: createId("social-media:website"),
			});
			await upsertById(tx, schema.projectsToSocialMedia, {
				id: createId("project-social:linkedin"),
				projectId: projectVersionId,
				socialMediaId: createId("social-media:linkedin"),
			});

			const organisationalUnitSocialLinks = [
				[dariahEricVersionId, createId("social-media:website")],
				[workingGroupVersionId, createId("social-media:website")],
				[workingGroupVersionId, createId("social-media:mastodon")],
				[secondWorkingGroupVersionId, createId("social-media:website")],
				[governanceBodyVersionId, createId("social-media:website")],
				[governanceBodyVersionId, createId("social-media:linkedin")],
				[memberCountryVersionId, createId("social-media:website")],
				[memberCountryVersionId, createId("social-media:linkedin")],
				[institutionVersionId, createId("social-media:website")],
				[consortiumVersionId, createId("social-media:website")],
			] as const;

			for (const [organisationalUnitId, socialMediaId] of organisationalUnitSocialLinks) {
				await upsertById(tx, schema.organisationalUnitsToSocialMedia, {
					id: createId(`org-social:${organisationalUnitId}:${socialMediaId}`),
					organisationalUnitId,
					socialMediaId,
				});
			}

			const reportingServiceId = createId("service:reporting");
			await upsertById(tx, schema.services, {
				id: reportingServiceId,
				name: "Kitchen Sink Reporting Service",
				typeId: assertLookupId(serviceTypeIds.get("internal"), 'Missing service type "internal".'),
				statusId: assertLookupId(serviceStatusIds.get("live"), 'Missing service status "live".'),
				comment: "A live national-consortium service used to prepopulate country reports.",
				dariahBranding: true,
				monitoring: true,
				privateSupplier: false,
			});
			await upsertById(tx, schema.servicesToOrganisationalUnits, {
				id: createId("service-org:reporting-consortium"),
				serviceId: reportingServiceId,
				organisationalUnitDocumentId: consortiumEntityId,
				roleId: assertLookupId(
					organisationalUnitServiceRoleIds.get("service_provider"),
					'Missing organisational unit service role "service_provider".',
				),
			});

			await tx
				.delete(schema.projectsToOrganisationalUnits)
				.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, projectEntityId));
			await tx
				.delete(schema.personsToOrganisationalUnits)
				.where(
					inArray(schema.personsToOrganisationalUnits.personDocumentId, [
						kitchenSinkPersonEntityId,
						relatedPersonEntityId,
					]),
				);
			await tx
				.delete(schema.organisationalUnitsRelations)
				.where(
					inArray(schema.organisationalUnitsRelations.unitDocumentId, [
						workingGroupEntityId,
						secondWorkingGroupEntityId,
						memberCountryEntityId,
						institutionEntityId,
						coordinatingInstitutionEntityId,
						representativeInstitutionEntityId,
						consortiumEntityId,
					]),
				);

			await tx.insert(schema.organisationalUnitsRelations).values([
				{
					id: createId("relation:working-group-to-eric"),
					unitDocumentId: workingGroupEntityId,
					relatedUnitDocumentId: dariahEricEntityId,
					status: assertLookupId(
						unitStatusIds.get("is_part_of"),
						'Missing organisational unit status "is_part_of".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("relation:working-group-two-to-eric"),
					unitDocumentId: secondWorkingGroupEntityId,
					relatedUnitDocumentId: dariahEricEntityId,
					status: assertLookupId(
						unitStatusIds.get("is_part_of"),
						'Missing organisational unit status "is_part_of".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("relation:country-to-eric"),
					unitDocumentId: memberCountryEntityId,
					relatedUnitDocumentId: dariahEricEntityId,
					status: assertLookupId(
						unitStatusIds.get("is_member_of"),
						'Missing organisational unit status "is_member_of".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("relation:institution-to-eric"),
					unitDocumentId: institutionEntityId,
					relatedUnitDocumentId: dariahEricEntityId,
					status: assertLookupId(
						unitStatusIds.get("is_partner_institution_of"),
						'Missing organisational unit status "is_partner_institution_of".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("relation:institution-to-country"),
					unitDocumentId: institutionEntityId,
					relatedUnitDocumentId: memberCountryEntityId,
					status: assertLookupId(
						unitStatusIds.get("is_located_in"),
						'Missing organisational unit status "is_located_in".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("relation:coordinating-institution-to-eric"),
					unitDocumentId: coordinatingInstitutionEntityId,
					relatedUnitDocumentId: dariahEricEntityId,
					status: assertLookupId(
						unitStatusIds.get("is_national_coordinating_institution_in"),
						'Missing organisational unit status "is_national_coordinating_institution_in".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("relation:coordinating-institution-to-country"),
					unitDocumentId: coordinatingInstitutionEntityId,
					relatedUnitDocumentId: memberCountryEntityId,
					status: assertLookupId(
						unitStatusIds.get("is_located_in"),
						'Missing organisational unit status "is_located_in".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("relation:representative-institution-to-eric"),
					unitDocumentId: representativeInstitutionEntityId,
					relatedUnitDocumentId: dariahEricEntityId,
					status: assertLookupId(
						unitStatusIds.get("is_national_representative_institution_in"),
						'Missing organisational unit status "is_national_representative_institution_in".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("relation:representative-institution-to-country"),
					unitDocumentId: representativeInstitutionEntityId,
					relatedUnitDocumentId: memberCountryEntityId,
					status: assertLookupId(
						unitStatusIds.get("is_located_in"),
						'Missing organisational unit status "is_located_in".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("relation:consortium-to-country"),
					unitDocumentId: consortiumEntityId,
					relatedUnitDocumentId: memberCountryEntityId,
					status: assertLookupId(
						unitStatusIds.get("is_national_consortium_of"),
						'Missing organisational unit status "is_national_consortium_of".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
			]);

			await tx.insert(schema.personsToOrganisationalUnits).values([
				{
					id: createId("person-org:wg-chair"),
					personDocumentId: kitchenSinkPersonEntityId,
					organisationalUnitDocumentId: workingGroupEntityId,
					roleTypeId: assertLookupId(
						personRoleIds.get("is_chair_of"),
						'Missing person role type "is_chair_of".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("person-org:working-group-two-chair"),
					personDocumentId: relatedPersonEntityId,
					organisationalUnitDocumentId: secondWorkingGroupEntityId,
					roleTypeId: assertLookupId(
						personRoleIds.get("is_chair_of"),
						'Missing person role type "is_chair_of".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("person-org:governance-chair"),
					personDocumentId: kitchenSinkPersonEntityId,
					organisationalUnitDocumentId: governanceBodyEntityId,
					roleTypeId: assertLookupId(
						personRoleIds.get("is_chair_of"),
						'Missing person role type "is_chair_of".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("person-org:governance-member"),
					personDocumentId: relatedPersonEntityId,
					organisationalUnitDocumentId: governanceBodyEntityId,
					roleTypeId: assertLookupId(
						personRoleIds.get("is_member_of"),
						'Missing person role type "is_member_of".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("person-org:country-national-coordinator"),
					personDocumentId: kitchenSinkPersonEntityId,
					organisationalUnitDocumentId: memberCountryEntityId,
					roleTypeId: assertLookupId(
						personRoleIds.get("national_coordinator"),
						'Missing person role type "national_coordinator".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("person-org:country-national-representative"),
					personDocumentId: relatedPersonEntityId,
					organisationalUnitDocumentId: memberCountryEntityId,
					roleTypeId: assertLookupId(
						personRoleIds.get("national_representative"),
						'Missing person role type "national_representative".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
			]);

			const [earlierCampaign] = await tx
				.insert(schema.reportingCampaigns)
				.values({
					id: createId("reporting-campaign:2025"),
					year: 2025,
					status: "closed",
				})
				.onConflictDoUpdate({
					target: schema.reportingCampaigns.year,
					set: { status: "closed" },
				})
				.returning({ id: schema.reportingCampaigns.id });
			assert(earlierCampaign);

			const [laterCampaign] = await tx
				.insert(schema.reportingCampaigns)
				.values({
					id: createId("reporting-campaign:2026"),
					year: 2026,
					status: "open",
				})
				.onConflictDoUpdate({
					target: schema.reportingCampaigns.year,
					set: { status: "open" },
				})
				.returning({ id: schema.reportingCampaigns.id });
			assert(laterCampaign);

			// Campaign configuration (DARIAH "Policy on the financial value of services" lump sums).
			// Seeded for both campaigns so the country report's operational-cost calculation produces a
			// real total that can be compared against the per-country threshold. Amounts mirror the
			// policy fixture used in `test/reporting/calculate-operational-cost.test.ts`.
			for (const campaign of [
				{ id: earlierCampaign.id, year: 2025 },
				{ id: laterCampaign.id, year: 2026 },
			]) {
				await tx
					.insert(schema.reportingCampaignContributionAmounts)
					.values(
						(
							[
								["national_coordinator", 11_000],
								["national_coordinator_deputy", 2_500],
								["is_chair_of_jrc", 5_500],
								["is_chair_of_ncc", 5_500],
								["is_chair_of_wg", 5_500],
								["is_member_of_jrc", 8_250],
							] as const
						).map(([roleType, amount]) => {
							return {
								id: createId(`reporting-campaign-contribution-amount:${campaign.year}:${roleType}`),
								campaignId: campaign.id,
								roleType,
								amount,
							};
						}),
					)
					.onConflictDoUpdate({
						target: [
							schema.reportingCampaignContributionAmounts.campaignId,
							schema.reportingCampaignContributionAmounts.roleType,
						],
						set: { amount: sql`excluded.amount` },
					});

				await tx
					.insert(schema.reportingCampaignEventAmounts)
					.values(
						(
							[
								["small", 500],
								["medium", 2_500],
								["large", 5_000],
								["very_large", 10_000],
								["dariah_commissioned", 50_000],
							] as const
						).map(([eventType, amount]) => {
							return {
								id: createId(`reporting-campaign-event-amount:${campaign.year}:${eventType}`),
								campaignId: campaign.id,
								eventType,
								amount,
							};
						}),
					)
					.onConflictDoUpdate({
						target: [
							schema.reportingCampaignEventAmounts.campaignId,
							schema.reportingCampaignEventAmounts.eventType,
						],
						set: { amount: sql`excluded.amount` },
					});

				await tx
					.insert(schema.reportingCampaignSocialMediaAmounts)
					.values(
						(
							[
								["website", 5_000],
								["other", 2_000],
							] as const
						).map(([category, amount]) => {
							return {
								id: createId(`reporting-campaign-social-media-amount:${campaign.year}:${category}`),
								campaignId: campaign.id,
								category,
								amount,
							};
						}),
					)
					.onConflictDoUpdate({
						target: [
							schema.reportingCampaignSocialMediaAmounts.campaignId,
							schema.reportingCampaignSocialMediaAmounts.category,
						],
						set: { amount: sql`excluded.amount` },
					});

				await tx
					.insert(schema.reportingCampaignServiceSizes)
					.values(
						(
							[
								["small", null, 6_875],
								["medium", 7_000, 20_625],
								["large", 170_000, 41_250],
								["very_large", 500_000, 61_875],
								["core", null, 82_500],
							] as const
						).map(([serviceSize, visitsThreshold, amount]) => {
							return {
								id: createId(`reporting-campaign-service-size:${campaign.year}:${serviceSize}`),
								campaignId: campaign.id,
								serviceSize,
								visitsThreshold,
								amount,
							};
						}),
					)
					.onConflictDoUpdate({
						target: [
							schema.reportingCampaignServiceSizes.campaignId,
							schema.reportingCampaignServiceSizes.serviceSize,
						],
						set: {
							visitsThreshold: sql`excluded.visits_threshold`,
							amount: sql`excluded.amount`,
						},
					});

				await tx
					.insert(schema.reportingCampaignCountryThresholds)
					.values({
						id: createId(`reporting-campaign-country-threshold:${campaign.year}`),
						campaignId: campaign.id,
						countryDocumentId: memberCountryEntityId,
						amount: 50_000,
					})
					.onConflictDoUpdate({
						target: [
							schema.reportingCampaignCountryThresholds.campaignId,
							schema.reportingCampaignCountryThresholds.countryDocumentId,
						],
						set: { amount: 50_000 },
					});
			}

			const [countryReport] = await tx
				.insert(schema.countryReports)
				.values({
					id: createId("country-report:2025"),
					campaignId: earlierCampaign.id,
					countryDocumentId: memberCountryEntityId,
					status: "draft",
					totalContributors: 12,
					smallEvents: 4,
					mediumEvents: 2,
					largeEvents: 1,
					veryLargeEvents: 0,
				})
				.onConflictDoUpdate({
					target: [schema.countryReports.campaignId, schema.countryReports.countryDocumentId],
					set: {
						status: "draft",
						totalContributors: 12,
						smallEvents: 4,
						mediumEvents: 2,
						largeEvents: 1,
						veryLargeEvents: 0,
					},
				})
				.returning({ id: schema.countryReports.id });
			assert(countryReport);

			const [workingGroupReport] = await tx
				.insert(schema.workingGroupReports)
				.values({
					id: createId("working-group-report:2025"),
					campaignId: earlierCampaign.id,
					workingGroupDocumentId: workingGroupEntityId,
					status: "draft",
					numberOfMembers: 18,
				})
				.onConflictDoUpdate({
					target: [
						schema.workingGroupReports.campaignId,
						schema.workingGroupReports.workingGroupDocumentId,
					],
					set: {
						status: "draft",
						numberOfMembers: 18,
					},
				})
				.returning({ id: schema.workingGroupReports.id });
			assert(workingGroupReport);

			await tx
				.insert(schema.countryReportProjectContributions)
				.values({
					id: createId("country-report-project-contribution:2025"),
					countryReportId: countryReport.id,
					projectDocumentId: projectEntityId,
					amountEuros: 48_500,
				})
				.onConflictDoUpdate({
					target: [
						schema.countryReportProjectContributions.countryReportId,
						schema.countryReportProjectContributions.projectDocumentId,
					],
					set: { amountEuros: 48_500 },
				});

			await tx
				.insert(schema.workingGroupReportSocialMedia)
				.values([
					{
						id: createId("working-group-report-social:2025:website"),
						workingGroupReportId: workingGroupReport.id,
						socialMediaId: createId("social-media:website"),
					},
					{
						id: createId("working-group-report-social:2025:mastodon"),
						workingGroupReportId: workingGroupReport.id,
						socialMediaId: createId("social-media:mastodon"),
					},
				])
				.onConflictDoNothing({
					target: [
						schema.workingGroupReportSocialMedia.workingGroupReportId,
						schema.workingGroupReportSocialMedia.socialMediaId,
					],
				});

			await tx.insert(schema.projectsToOrganisationalUnits).values([
				{
					id: createId("project-org:coordinator-eric"),
					projectDocumentId: projectEntityId,
					unitDocumentId: dariahEricEntityId,
					roleId: assertLookupId(
						projectRoleIds.get("coordinator"),
						'Missing project role "coordinator".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("project-org:participant-institution"),
					projectDocumentId: projectEntityId,
					unitDocumentId: institutionEntityId,
					roleId: assertLookupId(
						projectRoleIds.get("participant"),
						'Missing project role "participant".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("project-org:funder-country"),
					projectDocumentId: projectEntityId,
					unitDocumentId: memberCountryEntityId,
					roleId: assertLookupId(projectRoleIds.get("funder"), 'Missing project role "funder".'),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
				{
					id: createId("project-org:participant-governance"),
					projectDocumentId: projectEntityId,
					unitDocumentId: governanceBodyEntityId,
					roleId: assertLookupId(
						projectRoleIds.get("participant"),
						'Missing project role "participant".',
					),
					duration: createTimestampRange("2025-01-01T00:00:00.000Z", null),
				},
			]);

			// Contributors are document-level; key both endpoints to their document ids.
			await tx
				.delete(schema.spotlightArticlesToPersons)
				.where(eq(schema.spotlightArticlesToPersons.spotlightArticleDocumentId, spotlightEntityId));
			await tx
				.delete(schema.impactCaseStudiesToPersons)
				.where(eq(schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId, impactEntityId));

			await tx.insert(schema.spotlightArticlesToPersons).values([
				{
					spotlightArticleDocumentId: spotlightEntityId,
					personDocumentId: kitchenSinkPersonEntityId,
					role: "author",
				},
				{
					spotlightArticleDocumentId: spotlightEntityId,
					personDocumentId: relatedPersonEntityId,
					role: "editor",
				},
			]);
			await tx.insert(schema.impactCaseStudiesToPersons).values([
				{
					impactCaseStudyDocumentId: impactEntityId,
					personDocumentId: kitchenSinkPersonEntityId,
					role: "author",
				},
				{
					impactCaseStudyDocumentId: impactEntityId,
					personDocumentId: relatedPersonEntityId,
					role: "contributor",
				},
			]);

			const contentEntityIdsByType = new Map<
				(typeof schema.entityTypesEnum)[number],
				Array<string>
			>([
				["projects", [projectVersionId]],
				["events", [eventVersionId]],
				["pages", [pageVersionId]],
				["news", [newsVersionId]],
				["funding_calls", [fundingCallVersionId]],
				["opportunities", [opportunityVersionId]],
				["spotlight_articles", [spotlightVersionId]],
				["impact_case_studies", [impactVersionId]],
				["documents_policies", [documentPolicyVersionId]],
				["persons", [kitchenSinkPersonVersionId]],
				[
					"organisational_units",
					[
						workingGroupVersionId,
						secondWorkingGroupVersionId,
						governanceBodyVersionId,
						memberCountryVersionId,
					],
				],
			]);

			const fieldsToCreate = [...contentEntityIdsByType.entries()].flatMap(
				([entityType, entityIds]) => {
					const entityTypeId = assertLookupId(
						entityTypeIds.get(entityType),
						`Missing entity type "${entityType}".`,
					);
					const fieldDefinitions = entityTypeFieldNames.get(entityTypeId) ?? [];

					return entityIds.flatMap((entityId) =>
						fieldDefinitions.map((fieldDefinition) => {
							return {
								id: createId(`field:${entityId}:${fieldDefinition.fieldName}`),
								entityVersionId: entityId,
								fieldNameId: fieldDefinition.id,
								fieldName: fieldDefinition.fieldName,
							};
						}),
					);
				},
			);

			for (const field of fieldsToCreate) {
				await upsertById(tx, schema.fields, {
					id: field.id,
					entityVersionId: field.entityVersionId,
					fieldNameId: field.fieldNameId,
				});
			}

			const fieldIds = fieldsToCreate.map((field) => field.id);

			if (fieldIds.length > 0) {
				await tx
					.delete(schema.contentBlocks)
					.where(inArray(schema.contentBlocks.fieldId, fieldIds));
			}

			const contentBlocks = fieldsToCreate.flatMap((field) => [
				{
					id: createId(`block:${field.id}:hero`),
					fieldId: field.id,
					typeId: assertLookupId(
						contentBlockTypeIds.get("hero"),
						'Missing content block type "hero".',
					),
					position: 1,
				},
				{
					id: createId(`block:${field.id}:image`),
					fieldId: field.id,
					typeId: assertLookupId(
						contentBlockTypeIds.get("image"),
						'Missing content block type "image".',
					),
					position: 2,
				},
				{
					id: createId(`block:${field.id}:embed`),
					fieldId: field.id,
					typeId: assertLookupId(
						contentBlockTypeIds.get("embed"),
						'Missing content block type "embed".',
					),
					position: 3,
				},
				{
					id: createId(`block:${field.id}:data`),
					fieldId: field.id,
					typeId: assertLookupId(
						contentBlockTypeIds.get("data"),
						'Missing content block type "data".',
					),
					position: 4,
				},
				{
					id: createId(`block:${field.id}:accordion`),
					fieldId: field.id,
					typeId: assertLookupId(
						contentBlockTypeIds.get("accordion"),
						'Missing content block type "accordion".',
					),
					position: 5,
				},
				// An accordion holds panels, and a panel holds blocks — so the kitchen sink seeds the whole
				// subtree, which is also what makes it a fixture for nesting rather than only for the
				// accordion itself.
				{
					id: createId(`block:${field.id}:accordion-item`),
					fieldId: field.id,
					parentBlockId: createId(`block:${field.id}:accordion`),
					typeId: assertLookupId(
						contentBlockTypeIds.get("accordion_item"),
						'Missing content block type "accordion_item".',
					),
					position: 0,
				},
				{
					id: createId(`block:${field.id}:accordion-item-body`),
					fieldId: field.id,
					parentBlockId: createId(`block:${field.id}:accordion-item`),
					typeId: assertLookupId(
						contentBlockTypeIds.get("rich_text"),
						'Missing content block type "rich_text".',
					),
					position: 0,
				},
				{
					id: createId(`block:${field.id}:rich-text`),
					fieldId: field.id,
					typeId: assertLookupId(
						contentBlockTypeIds.get("rich_text"),
						'Missing content block type "rich_text".',
					),
					position: 6,
				},
			]);

			if (contentBlocks.length > 0) {
				const uniqueContentBlocks = new Map(
					contentBlocks.map((contentBlock) => [contentBlock.id, contentBlock]),
				);

				for (const contentBlock of uniqueContentBlocks.values()) {
					await upsertById(tx, schema.contentBlocks, contentBlock);
				}
			}

			for (const field of fieldsToCreate) {
				const heroBlockId = createId(`block:${field.id}:hero`);
				const imageBlockId = createId(`block:${field.id}:image`);
				const embedBlockId = createId(`block:${field.id}:embed`);
				const dataBlockId = createId(`block:${field.id}:data`);
				const accordionBlockId = createId(`block:${field.id}:accordion`);
				const accordionItemBlockId = createId(`block:${field.id}:accordion-item`);
				const accordionItemBodyBlockId = createId(`block:${field.id}:accordion-item-body`);
				const richTextBlockId = createId(`block:${field.id}:rich-text`);

				await upsertById(tx, schema.heroContentBlocks, {
					id: heroBlockId,
					title: `Kitchen Sink ${field.fieldName} Hero`,
					eyebrow: "Kitchen Sink",
					imageId: createId("asset:hero-image"),
					ctas: [
						{ label: "Primary CTA", url: "https://example.org/kitchen-sink/primary" },
						{ label: "Secondary CTA", url: "https://example.org/kitchen-sink/secondary" },
					],
				});
				await upsertById(tx, schema.imageContentBlocks, {
					id: imageBlockId,
					imageId: createId("asset:image"),
					caption: plainTextToRichText(`Kitchen sink image block for ${field.fieldName}.`),
					captionMode: "override",
				});
				await upsertById(tx, schema.embedContentBlocks, {
					id: embedBlockId,
					url: "https://example.org/embeds/kitchen-sink",
					title: `Kitchen Sink ${field.fieldName} Embed`,
					caption: plainTextToRichText(`Embedded content for ${field.fieldName}.`),
				});
				await upsertById(tx, schema.dataContentBlocks, {
					id: dataBlockId,
					typeId: assertLookupId(
						dataContentBlockTypeIds.get("events"),
						'Missing data content block type "events".',
					),
					limit: 3,
					selectedIds: null,
				});
				await tx
					.insert(schema.accordionContentBlocks)
					.values({ id: accordionBlockId })
					.onConflictDoNothing();
				await upsertById(tx, schema.accordionItemContentBlocks, {
					id: accordionItemBlockId,
					title: `${field.fieldName} Question`,
				});
				await upsertById(tx, schema.richTextContentBlocks, {
					id: accordionItemBodyBlockId,
					content: plainTextToRichText(`Accordion answer for ${field.fieldName}.`),
				});
				await upsertById(tx, schema.richTextContentBlocks, {
					id: richTextBlockId,
					content: {
						type: "doc",
						content: [
							{
								type: "heading",
								attrs: { level: 2 },
								content: [{ type: "text", text: `${field.fieldName} Heading` }],
							},
							{
								type: "paragraph",
								content: [
									{
										type: "text",
										text: `Rich text content seeded for ${field.fieldName}.`,
									},
								],
							},
						],
					},
				});
			}

			const relatedEntityOwners = [
				projectEntityId,
				workingGroupEntityId,
				secondWorkingGroupEntityId,
				governanceBodyEntityId,
				memberCountryEntityId,
				eventEntityId,
				pageEntityId,
				newsEntityId,
				fundingCallEntityId,
				opportunityEntityId,
				spotlightEntityId,
				impactEntityId,
			];

			await tx
				.delete(schema.entitiesToEntities)
				.where(inArray(schema.entitiesToEntities.entityId, relatedEntityOwners));
			await tx
				.delete(schema.entitiesToResources)
				.where(inArray(schema.entitiesToResources.entityId, relatedEntityOwners));

			const entityRelations = new Map(
				relatedEntityOwners
					.flatMap((entityId) => {
						const relatedIds = [kitchenSinkPersonEntityId, pageEntityId].filter(
							(relatedEntityId) => relatedEntityId !== entityId,
						);

						return relatedIds.map((relatedEntityId) => {
							return { entityId, relatedEntityId };
						});
					})
					.map((relation) => [`${relation.entityId}:${relation.relatedEntityId}`, relation]),
			);

			if (entityRelations.size > 0) {
				await tx.insert(schema.entitiesToEntities).values([...entityRelations.values()]);
			}

			if (resourceIds.length > 0) {
				await tx.insert(schema.entitiesToResources).values(
					relatedEntityOwners.flatMap((entityId) =>
						resourceIds.map((resourceId) => {
							return { entityId, resourceId };
						}),
					),
				);
			}
		});

		log.success('Successfully created kitchen-sink entities for slug "kitchen-sink".');
	} finally {
		await db.$client.end();
	}
}

main().catch((error: unknown) => {
	log.error("Failed to create kitchen-sink entities.\n", error);
	process.exitCode = 1;
});
