import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { join } from "node:path";

import {
	type Database,
	type Transaction,
	createDatabaseService,
} from "@acdh-knowledge-base/database";
import * as schema from "@acdh-knowledge-base/database/schema";
import { eq, inArray } from "@acdh-knowledge-base/database/sql";
import { type ResourceDocument, resourceSources, resourceTypes } from "@acdh-knowledge-base/search";
import { createSearchAdminService } from "@acdh-knowledge-base/search/admin";
import { createStorageService } from "@acdh-knowledge-base/storage";
import { log } from "@acdh-oeaw/lib";

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
	const _table = table;

	await db
		.insert(_table)
		.values(row as never)
		.onConflictDoUpdate({
			target: _table.id,
			set: set as never,
		});
}

async function upsertPublishedDocument(
	db: Db,
	row: { id: string; statusId: string; typeId: string; slug: string; versionId: string },
): Promise<{ documentId: string; versionId: string }> {
	const [document] = await db
		.insert(schema.entities)
		.values({
			id: row.id,
			typeId: row.typeId,
			slug: row.slug,
		})
		.onConflictDoUpdate({
			target: [schema.entities.typeId, schema.entities.slug],
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
		})
		.onConflictDoUpdate({
			target: [schema.entityVersions.entityId, schema.entityVersions.statusId],
			set: {
				updatedAt: new Date(),
			},
		})
		.returning({ id: schema.entityVersions.id });

	if (version == null) {
		throw new Error(`Failed to upsert published version for entity "${document.id}".`);
	}

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
			links: ["https://example.org/resources/kitchen-sink-publication"],
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
			links: ["https://example.org/resources/kitchen-sink-training"],
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
				opportunitySourceRows,
				socialMediaTypeRows,
				contentBlockTypeRows,
				dataContentBlockTypeRows,
				licenseRows,
				fieldNameRows,
			] = await Promise.all([
				tx.select().from(schema.entityTypes),
				tx.select().from(schema.entityStatus),
				tx.select().from(schema.organisationalUnitTypes),
				tx.select().from(schema.organisationalUnitStatus),
				tx.select().from(schema.personRoleTypes),
				tx.select().from(schema.projectRoles),
				tx.select().from(schema.projectScopes),
				tx.select().from(schema.opportunitySources),
				tx.select().from(schema.socialMediaTypes),
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
			]);

			const entityTypeIds = new Map(entityTypeRows.map((row) => [row.type, row.id]));
			const entityStatusIds = new Map(entityStatusRows.map((row) => [row.type, row.id]));
			const unitTypeIds = new Map(unitTypeRows.map((row) => [row.type, row.id]));
			const unitStatusIds = new Map(unitStatusRows.map((row) => [row.status, row.id]));
			const personRoleIds = new Map(personRoleRows.map((row) => [row.type, row.id]));
			const projectRoleIds = new Map(projectRoleRows.map((row) => [row.role, row.id]));
			const projectScopeIds = new Map(projectScopeRows.map((row) => [row.scope, row.id]));
			const opportunitySourceIds = new Map(
				opportunitySourceRows.map((row) => [row.source, row.id]),
			);
			const socialMediaTypeIds = new Map(socialMediaTypeRows.map((row) => [row.type, row.id]));
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
					caption: "Kitchen sink featured image.",
					alt: "Kitchen sink featured illustration",
					licenseId,
				},
				{
					id: createId("asset:hero-image"),
					key: uploadedAssets.heroImageKey,
					label: "Kitchen Sink Hero Image",
					filename: "hero-image.png",
					mimeType: "image/png",
					caption: "Kitchen sink hero image.",
					alt: "Kitchen sink hero illustration",
					licenseId,
				},
				{
					id: createId("asset:avatar"),
					key: uploadedAssets.avatarKey,
					label: "Kitchen Sink Avatar",
					filename: "avatar.png",
					mimeType: "image/png",
					caption: "Kitchen sink avatar.",
					alt: "Kitchen sink avatar portrait",
					licenseId,
				},
				{
					id: createId("asset:document"),
					key: uploadedAssets.documentKey,
					label: "Kitchen Sink Document",
					filename: "document.pdf",
					mimeType: "application/pdf",
					caption: "Kitchen sink policy PDF.",
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
			const governanceBodyDocument = {
				id: createId("entity:governance-body"),
				versionId: createId("version:governance-body"),
			};
			const memberCountryDocument = {
				id: createId("entity:country"),
				versionId: createId("version:country"),
			};
			const institutionDocument = {
				id: createId("entity:institution"),
				versionId: createId("version:institution"),
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
			];

			const entityIdsBySeedId = new Map<string, { documentId: string; versionId: string }>();

			for (const entity of entities) {
				const document = await upsertPublishedDocument(tx, entity);
				entityIdsBySeedId.set(entity.id, document);
			}

			const projectEntityId = entityIdsBySeedId.get(projectDocument.id)!.documentId;
			const projectVersionId = entityIdsBySeedId.get(projectDocument.id)!.versionId;
			const dariahEricVersionId = entityIdsBySeedId.get(dariahEricDocument.id)!.versionId;
			const dariahEricEntityId = entityIdsBySeedId.get(dariahEricDocument.id)!.documentId;
			const workingGroupEntityId = entityIdsBySeedId.get(workingGroupDocument.id)!.documentId;
			const workingGroupVersionId = entityIdsBySeedId.get(workingGroupDocument.id)!.versionId;
			const governanceBodyEntityId = entityIdsBySeedId.get(governanceBodyDocument.id)!.documentId;
			const governanceBodyVersionId = entityIdsBySeedId.get(governanceBodyDocument.id)!.versionId;
			const memberCountryEntityId = entityIdsBySeedId.get(memberCountryDocument.id)!.documentId;
			const memberCountryVersionId = entityIdsBySeedId.get(memberCountryDocument.id)!.versionId;
			const institutionVersionId = entityIdsBySeedId.get(institutionDocument.id)!.versionId;
			const institutionEntityId = entityIdsBySeedId.get(institutionDocument.id)!.documentId;
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
				imageId: createId("asset:image"),
			});
			await upsertById(tx, schema.news, {
				id: newsVersionId,
				title: "Kitchen Sink News",
				summary: "A news item seeded for API contract testing.",
				imageId: createId("asset:image"),
			});
			await upsertById(tx, schema.fundingCalls, {
				id: fundingCallVersionId,
				title: "Kitchen Sink Funding Call",
				summary: "A funding call seeded for API contract testing.",
				duration: createTimestampRange("2026-06-01T00:00:00.000Z", "2026-06-30T23:59:59.000Z"),
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
			});
			await upsertById(tx, schema.spotlightArticles, {
				id: spotlightVersionId,
				title: "Kitchen Sink Spotlight Article",
				summary: "A spotlight article seeded for API contract testing.",
				imageId: createId("asset:image"),
			});
			await upsertById(tx, schema.impactCaseStudies, {
				id: impactVersionId,
				title: "Kitchen Sink Impact Case Study",
				summary: "An impact case study seeded for API contract testing.",
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
				call: "HORIZON-INFRA-2025",
				topic: "Interoperability and integration testing",
				imageId: createId("asset:image"),
				scopeId: assertLookupId(projectScopeIds.get("eu"), 'Missing project scope "eu".'),
			});

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
						memberCountryEntityId,
						institutionEntityId,
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
					[workingGroupVersionId, governanceBodyVersionId, memberCountryVersionId],
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
					caption: `Kitchen sink image block for ${field.fieldName}.`,
				});
				await upsertById(tx, schema.embedContentBlocks, {
					id: embedBlockId,
					url: "https://example.org/embeds/kitchen-sink",
					title: `Kitchen Sink ${field.fieldName} Embed`,
					caption: `Embedded content for ${field.fieldName}.`,
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
				await upsertById(tx, schema.accordionContentBlocks, {
					id: accordionBlockId,
					items: [
						{
							title: `${field.fieldName} Question`,
							content: {
								type: "doc",
								content: [
									{
										type: "paragraph",
										content: [
											{
												type: "text",
												text: `Accordion answer for ${field.fieldName}.`,
											},
										],
									},
								],
							},
						},
					],
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
