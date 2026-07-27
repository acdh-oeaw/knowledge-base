import path from "node:path";

import { and, createDatabaseService, eq, schema } from "@acdh-knowledge-base/database";
import { createStorageService } from "@acdh-knowledge-base/storage";
import type { AssetPrefix } from "@acdh-knowledge-base/storage/config";
import { buffer } from "@acdh-knowledge-base/storage/lib";
import { assert, keyBy, log } from "@acdh-oeaw/lib";
import slugify from "@sindresorhus/slugify";
import { generateJSON } from "@tiptap/html";
import { StarterKit } from "@tiptap/starter-kit";

import { apiBaseUrl, assetSizeLimit, assetsGithubPath } from "../config/data-migration.config";
import { env } from "../config/env.config";
import {
	createPublishedDocument,
	createSortName,
	logToFile,
	parseEventSummary,
} from "../src/lib/utils";

interface ClariahATWebsiteInstitution {
	name?: string | undefined;
	href?: string | undefined;
	logo?: string | undefined;
	description: string | null;
	institutions: Array<{
		name: string;
		href: string;
		logo: string;
	}>;
	people: Array<{
		name: string;
		image: string;
		description: string | null;
		links: Array<{
			kind:
				| "youtube"
				| "bluesky"
				| "facebook"
				| "instagram"
				| "linkedin"
				| "mastodon"
				| "orcid"
				| "podcast"
				| "twitter"
				| "website";
			href: string;
		}>;
	}>;
}

type Institution = Record<"en" | "de", ClariahATWebsiteInstitution | null>;

interface ClariahATEvent {
	title?: string | undefined;
	date?: string | null;
	image?: string | undefined;
	eventDate?: string | undefined;
	eventLocation?: string | undefined;
	shortTitle?: string | undefined;
	summary?: string | undefined;
	description: string | null;
}

type Event = Record<"en" | "de", ClariahATEvent | null>;

interface ClariahATNewsItem {
	title?: string | undefined;
	date?: string | null;
	image?: string | undefined;
	shortTitle?: string | undefined;
	summary?: string | undefined;
	description: string | null;
}

type NewsItem = Record<"en" | "de", ClariahATNewsItem | null>;

interface ClariahATProject {
	title?: string | undefined;
	startDate?: string | undefined;
	endDate?: string | undefined;
	image?: string | undefined;
	shortTitle?: string | undefined;
	summary?: string | undefined;
	description: string | null;
	hostingOrganizations: Array<string>;
	responsiblePersons: Array<string>;
	links: Array<{ label: string; url: string }>;
	tags: Array<{ name: string; tid: number }>;
}

type Project = Record<"en" | "de", ClariahATProject | null>;

interface ClariahATPage {
	title?: string | undefined;
	image?: string | undefined;
	shortTitle?: string | undefined;
	summary?: string | undefined;
	content: string | null;
}

type Page = Record<"en" | "de", ClariahATPage | null>;

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

async function main() {
	const organisationalUnitTypes = await db.query.organisationalUnitTypes.findMany();
	const organisationalUnitTypesByType = keyBy(organisationalUnitTypes, (item) => item.type);

	const organisationalUnitStatus = await db.query.organisationalUnitStatus.findMany();
	const organisationalUnitStatusByType = keyBy(organisationalUnitStatus, (item) => item.status);

	const personRoleTypes = await db.query.personRoleTypes.findMany();
	const personRoleTypesByType = keyBy(personRoleTypes, (item) => item.type);

	const projectRoles = await db.query.projectRoles.findMany();
	const projectRolesByRole = keyBy(projectRoles, (item) => item.role);

	const projectScopes = await db.query.projectScopes.findMany();
	const projectScopesByScope = keyBy(projectScopes, (item) => item.scope);

	const socialMediaTypes = await db.query.socialMediaTypes.findMany();
	const socialMediaTypesByType = keyBy(socialMediaTypes, (item) => item.type);

	const personSlugDocumentIds = new Map<string, string>();
	const institutionsSlugDocumentIds = new Map<string, string>();

	const placeholderInput = await buffer.fromFilePath(
		path.join(process.cwd(), "scripts", "logo-clariah-at.svg"),
	);
	const placeholderMetadata = await buffer.getMetadata(placeholderInput);

	const entityTypes = await db.query.entityTypes.findMany();
	const entityTypesByType = keyBy(entityTypes, (item) => item.type);

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

	const orgUnitTypeId = entityTypesByType.organisational_units.id;

	const [dariahEuDoc] = await db
		.select({ id: schema.entities.id })
		.from(schema.entities)
		.where(and(eq(schema.entities.typeId, orgUnitTypeId), eq(schema.entities.slug, "dariah-eu")));

	assert(dariahEuDoc);

	const dariahEuDocId = dariahEuDoc.id;

	/**
	 * Migrate insitutions: The consortium endpoint returns all partner institutions plus people
	 * affiliated with it plus "sub institutions"
	 */

	/** Migrate projects */

	const projectsResponse = await fetch(`${apiBaseUrl}/api/data/projects`, {});
	const projects = (await projectsResponse.json()) as Array<Project>;

	for (const project of projects) {
		const projectEN = project.en;
		assert(projectEN?.title);
		const projectTitle = projectEN.title;
		const slug = slugify(projectTitle);

		await db.transaction(async (tx) => {
			const { documentId: projectDocumentId, versionId: projectVersionId } =
				await createPublishedDocument(tx, entityTypesByType.projects.id, slug);

			console.log(projectTitle);
			console.log(projectDocumentId);

			const asset = { id: null };
			/*if (projectEN.image != null) {
				const imageUrl = new URL(`${assetsGithubPath}${projectEN.image}`);
				const imageResponse = await fetch(imageUrl, { method: "HEAD" });
				const size = Number(imageResponse.headers.get("content-length"));
				if (size > assetSizeLimit) {
					logToFile(`image too big. resize and upload manually. ${String(imageUrl)}`);
				} else {
					const input = await buffer.fromUrl(imageUrl);
					const metadata = await buffer.getMetadata(input);
					const prefix = "images" as AssetPrefix;
					const label = projectEN.title!;
					const { key } = (await storage.upload({ prefix, input, metadata })).unwrap();

					[asset] = await db
						.insert(schema.assets)
						.values({
							key,
							label,
							mimeType: metadata["content-type"],
							caption: "",
							alt: "",
							size,
						})
						.returning({ id: schema.assets.id });
				}
			}*/
			assert(placeholderAsset);

			const projectStartDate =
				projectEN.startDate != null
					? new Date(
							Date.UTC(
								...(projectEN.startDate
									.split("-")
									.map((n: string, i) => (i === 1 ? Number(n) - 1 : Number(n))) as [
									number,
									number,
									number,
								]),
							),
						)
					: new Date(Date.UTC(1900, 0, 1));
			const projectEndDate =
				projectEN.endDate != null
					? new Date(
							Date.UTC(
								...(projectEN.endDate
									.split("-")
									.map((n: string, i) => (i === 1 ? Number(n) - 1 : Number(n))) as [
									number,
									number,
									number,
								]),
							),
						)
					: undefined;

			await tx.insert(schema.projects).values({
				id: projectVersionId,
				acronym: "",
				name: projectEN.title!,
				scopeId: projectScopesByScope.national.id,
				summary: projectEN.summary ?? "",
				imageId: asset?.id ?? placeholderAsset.id,
				duration: {
					start: projectStartDate,
					end: projectEndDate,
				},
				metadata: { tags: projectEN.tags },
			});

			if (projectEN.description != null) {
				const content = generateJSON(projectEN.description, [StarterKit]);

				const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
					where: {
						entityTypeId: entityTypesByType.projects.id,
						fieldName: "description",
					},
				});

				assert(fieldName);

				const [field] = await tx
					.insert(schema.fields)
					.values({
						entityVersionId: projectVersionId,
						fieldNameId: fieldName.id,
					})
					.returning({ id: schema.fields.id });

				assert(field);

				const contentBlockTypes = await db.query.contentBlockTypes.findMany();
				const contentBlockTypesByType = keyBy(contentBlockTypes, (item) => item.type);

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

			for (const person of projectEN.responsiblePersons) {
				const slug = slugify(person);
				const personDocIdBySlug = personSlugDocumentIds.get(slug);

				let personDocumentId: string;

				if (personDocIdBySlug != null) {
					console.log("here");
					personDocumentId = personDocIdBySlug;
				} else {
					console.log("now here");
					const { documentId, versionId } = await createPublishedDocument(
						tx,
						entityTypesByType.persons.id,
						slug,
					);
					assert(placeholderAsset);

					await tx
						.insert(schema.persons)
						.values({
							id: versionId,
							name: person,
							sortName: createSortName(person),
						})
						.returning({ id: schema.persons.id });
					personDocumentId = documentId;
				}
				console.log(personDocumentId);

				await tx.insert(schema.projectsToPersons).values({
					projectDocumentId,
					personDocumentId,
					duration: {
						start: projectStartDate,
						end: projectEndDate,
					},
					roleId: projectRolesByRole.affiliated.id,
				});
			}

			for (const institution of projectEN.hostingOrganizations) {
				const slug = slugify(institution);
				const institutionDocIdBySlug = institutionsSlugDocumentIds.get(slug);

				let institutionDocumentId: string;

				await db.transaction(async (tx) => {
					if (institutionDocIdBySlug != null) {
						institutionDocumentId = institutionDocIdBySlug;
					} else {
						const { documentId, versionId } = await createPublishedDocument(
							tx,
							entityTypesByType.organisational_units.id,
							slug,
						);
						assert(placeholderAsset);

						await tx
							.insert(schema.organisationalUnits)
							.values({
								id: versionId,
								name: institution,
								typeId: organisationalUnitTypesByType.institution.id,
							})
							.returning({ id: schema.organisationalUnits.id });
						institutionDocumentId = documentId;
					}

					await tx.insert(schema.projectsToOrganisationalUnits).values({
						projectDocumentId,
						unitDocumentId: institutionDocumentId,
						duration: {
							start: projectStartDate,
							end: projectEndDate,
						},
						roleId: projectRolesByRole.affiliated.id,
					});
				});
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
