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
	name?: string;
	href?: string;
	logo?: string;
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
	title?: string;
	date?: string | null;
	image?: string;
	eventDate?: string;
	eventLocation?: string;
	shortTitle?: string;
	summary?: string;
	description: string | null;
}

type Event = Record<"en" | "de", ClariahATEvent | null>;

interface ClariahATNewsItem {
	title?: string;
	date?: string | null;
	image?: string;
	shortTitle?: string;
	summary?: string;
	description: string | null;
}

type NewsItem = Record<"en" | "de", ClariahATNewsItem | null>;

interface ClariahATProject {
	title?: string;
	startDate?: string;
	endDate?: string;
	image?: string;
	shortTitle?: string;
	summary?: string;
	description: string | null;
	hostingOrganizations: Array<string>;
	responsiblePersons: Array<string>;
	links: Array<{ label: string; url: string }>;
	additionalImages: Array<{ image: string; alt: string; licence: string }>;
	tags: Array<{ name: string; tid: number }>;
}

type Project = Record<"en" | "de", ClariahATProject | null>;

interface ClariahATPage {
	title?: string;
	image?: string;
	shortTitle?: string;
	summary?: string;
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
	const organisationalUnitsSlugDocumentIds = new Map<string, string>();

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

	const response = await fetch(`${apiBaseUrl}/api/data/consortium`, {});
	// consortium endpoint returns array of institutions
	const institutions = (await response.json()) as Array<Institution>;

	const orgUnitType = await db.query.organisationalUnitTypes.findFirst({
		where: { type: "institution" },
		columns: { id: true },
	});

	assert(orgUnitType);

	let countryDocumentId: string;
	let countryVersionId: string;

	/** Create country Austria * */

	await db.transaction(async (tx) => {
		({ documentId: countryDocumentId, versionId: countryVersionId } = await createPublishedDocument(
			tx,
			entityTypesByType.organisational_units.id,
			"austria",
		));

		const [countryOrgUnit] = await tx
			.insert(schema.organisationalUnits)
			.values({
				id: countryVersionId,
				acronym: "at",
				name: "Austria",
				summary: "",
				typeId: organisationalUnitTypesByType.country.id,
			})
			.returning({ id: schema.organisationalUnits.id });

		/** Create national consortium CLARIAH-AT * */

		assert(placeholderAsset);

		const { documentId: ncDocumentId, versionId: ncVersionId } = await createPublishedDocument(
			tx,
			entityTypesByType.organisational_units.id,
			"clariah-at",
		);

		const [ncOrgUnit] = await tx
			.insert(schema.organisationalUnits)
			.values({
				id: ncVersionId,
				name: "CLARIAH-AT",
				sshocMarketplaceActorId: 9403,
				imageId: placeholderAsset.id,
				summary:
					"An open network facilitating the application of digital methods in the humanities and the development of relevant research infrastructures.",
				typeId: organisationalUnitTypesByType.national_consortium.id,
			})
			.returning({ id: schema.organisationalUnits.id });

		assert(countryOrgUnit);
		assert(ncOrgUnit);

		organisationalUnitsSlugDocumentIds.set("clariah-at", ncDocumentId);

		// create a relationship between the country and consortium

		await tx.insert(schema.organisationalUnitsRelations).values({
			unitDocumentId: ncDocumentId,
			relatedUnitDocumentId: countryDocumentId,
			duration: { start: new Date(Date.UTC(1900, 0, 1)) },
			status: organisationalUnitStatusByType.is_national_consortium_of.id,
		});

		// create a relationship between the country and eric

		await tx.insert(schema.organisationalUnitsRelations).values({
			unitDocumentId: countryDocumentId,
			relatedUnitDocumentId: dariahEuDocId,
			duration: {
				start: new Date(Date.UTC(1900, 0, 1)),
			},
			status: organisationalUnitStatusByType.is_member_of.id,
		});
	});

	log.info("Migrating institutions...");

	for (const institution of institutions) {
		const institutionEN = institution.en;
		assert(institutionEN?.name);
		const institutionName = institutionEN.name;
		const slug = slugify(institutionName);
		let institutionDocumentId: string;

		await db.transaction(async (tx) => {
			const { documentId, versionId } = await createPublishedDocument(
				tx,
				entityTypesByType.organisational_units.id,
				slug,
			);

			institutionDocumentId = documentId;
			organisationalUnitsSlugDocumentIds.set(slug, documentId);

			let asset;

			if (institutionEN.logo != null) {
				const imageUrl = new URL(`${assetsGithubPath}${institutionEN.logo}`);
				const imageResponse = await fetch(imageUrl, { method: "HEAD" });
				const size = Number(imageResponse.headers.get("content-length"));
				if (size > assetSizeLimit) {
					logToFile(`image too big. resize and upload manually. ${String(imageUrl)}`);
				} else {
					const input = await buffer.fromUrl(imageUrl);
					const metadata = await buffer.getMetadata(input);
					const prefix = "logos" as AssetPrefix;
					const label = institutionEN.name;
					const { key } = (await storage.upload({ prefix, input, metadata })).unwrap();

					assert(label);

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
			}

			assert(placeholderAsset);

			const [orgUnit] = await tx
				.insert(schema.organisationalUnits)
				.values({
					id: versionId,
					name: institutionName,
					summary: "",
					typeId: organisationalUnitTypesByType.institution.id,
					imageId: asset?.id ?? placeholderAsset.id,
				})
				.returning({ id: schema.organisationalUnits.id });

			assert(orgUnit);

			await tx.insert(schema.organisationalUnitsRelations).values({
				unitDocumentId: documentId,
				relatedUnitDocumentId: dariahEuDocId,
				duration: {
					start: new Date(Date.UTC(1900, 0, 1)),
				},
				status: organisationalUnitStatusByType.is_partner_institution_of.id,
			});

			assert(countryDocumentId);

			await tx.insert(schema.organisationalUnitsRelations).values({
				unitDocumentId: documentId,
				relatedUnitDocumentId: countryDocumentId,
				duration: { start: new Date(Date.UTC(1900, 0, 1)) },
				status: organisationalUnitStatusByType.is_located_in.id,
			});

			const content = generateJSON(institutionEN.description ?? "", [StarterKit]);

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
					entityVersionId: versionId,
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

			if (institutionEN.href != null) {
				const [kbSocialMedia] = await tx
					.insert(schema.socialMedia)
					.values({
						name: `${institutionName} Website`,
						typeId: socialMediaTypesByType.website.id,
						url: institutionEN.href,
						duration: {
							start: new Date(Date.UTC(1900, 0, 1)),
						},
					})
					.returning({ id: schema.socialMedia.id });

				assert(kbSocialMedia);

				await tx.insert(schema.organisationalUnitsToSocialMedia).values({
					organisationalUnitId: orgUnit.id,
					socialMediaId: kbSocialMedia.id,
				});
			}
		});

		for (const subInstitution of institutionEN.institutions) {
			const slug = slugify(subInstitution.name);

			await db.transaction(async (tx) => {
				const { documentId, versionId } = await createPublishedDocument(
					tx,
					entityTypesByType.organisational_units.id,
					slug,
				);

				organisationalUnitsSlugDocumentIds.set(slug, documentId);

				let asset;

				if (subInstitution.logo) {
					const imageUrl = new URL(`${assetsGithubPath}${subInstitution.logo}`);
					const imageResponse = await fetch(imageUrl, { method: "HEAD" });
					const size = Number(imageResponse.headers.get("content-length"));
					if (size > assetSizeLimit) {
						logToFile(`image too big. resize and upload manually. ${String(imageUrl)}`);
					} else {
						const input = await buffer.fromUrl(imageUrl);
						const metadata = await buffer.getMetadata(input);
						const prefix = "logos" as AssetPrefix;
						const label = subInstitution.name;
						const { key } = (await storage.upload({ prefix, input, metadata })).unwrap();

						assert(label);

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
				}

				const [orgUnit] = await tx
					.insert(schema.organisationalUnits)
					.values({
						id: versionId,
						name: subInstitution.name,
						summary: "",
						typeId: organisationalUnitTypesByType.institution.id,
						imageId: asset?.id,
					})
					.returning({ id: schema.organisationalUnits.id });

				assert(orgUnit);

				await tx.insert(schema.organisationalUnitsRelations).values({
					unitDocumentId: documentId,
					relatedUnitDocumentId: dariahEuDocId,
					duration: {
						start: new Date(Date.UTC(1900, 0, 1)),
					},
					status: organisationalUnitStatusByType.is_partner_institution_of.id,
				});

				await tx.insert(schema.organisationalUnitsRelations).values({
					unitDocumentId: documentId,
					relatedUnitDocumentId: institutionDocumentId,
					duration: {
						start: new Date(Date.UTC(1900, 0, 1)),
					},
					status: organisationalUnitStatusByType.is_part_of.id,
				});

				assert(countryDocumentId);

				await tx.insert(schema.organisationalUnitsRelations).values({
					unitDocumentId: documentId,
					relatedUnitDocumentId: countryDocumentId,
					duration: { start: new Date(Date.UTC(1900, 0, 1)) },
					status: organisationalUnitStatusByType.is_located_in.id,
				});

				const [kbSocialMedia] = await tx
					.insert(schema.socialMedia)
					.values({
						name: `${subInstitution.name} Website`,
						typeId: socialMediaTypesByType.website.id,
						url: subInstitution.href,
						duration: {
							start: new Date(Date.UTC(1900, 0, 1)),
						},
					})
					.returning({ id: schema.socialMedia.id });

				assert(kbSocialMedia);

				await tx.insert(schema.organisationalUnitsToSocialMedia).values({
					organisationalUnitId: orgUnit.id,
					socialMediaId: kbSocialMedia.id,
				});
			});
		}

		for (const person of institutionEN.people) {
			const slug = slugify(person.name);

			await db.transaction(async (tx) => {
				const { documentId, versionId } = await createPublishedDocument(
					tx,
					entityTypesByType.persons.id,
					slug,
				);
				let asset;
				if (person.image) {
					const imageUrl = new URL(`${assetsGithubPath}${person.image}`);
					const imageResponse = await fetch(imageUrl, { method: "HEAD" });
					const size = Number(imageResponse.headers.get("content-length"));
					if (size > assetSizeLimit) {
						logToFile(`image too big. resize and upload manually. ${String(imageUrl)}`);
					} else {
						const input = await buffer.fromUrl(imageUrl);
						const metadata = await buffer.getMetadata(input);
						const prefix = "avatars" as AssetPrefix;
						const label = person.name;
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
				}
				assert(placeholderAsset);

				const [kbPerson] = await tx
					.insert(schema.persons)
					.values({
						id: versionId,
						name: person.name,
						sortName: createSortName(person.name),
						imageId: asset?.id ?? placeholderAsset.id,
					})
					.returning({ id: schema.persons.id });

				assert(kbPerson);

				personSlugDocumentIds.set(slug, documentId);

				await tx.insert(schema.personsToOrganisationalUnits).values({
					personDocumentId: documentId,
					organisationalUnitDocumentId: institutionDocumentId,
					duration: { start: new Date(Date.UTC(1900, 0, 1)) },
					roleTypeId: personRoleTypesByType.is_affiliated_with.id,
				});

				if (person.description != null) {
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
							entityVersionId: versionId,
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

				for (const link of person.links) {
					const socialMediaType =
						socialMediaTypesByType[link.kind as keyof typeof socialMediaTypesByType] ??
						socialMediaTypesByType.other;

					const [kbSocialMedia] = await tx
						.insert(schema.socialMedia)
						.values({
							name: `${person.name} ${link.kind}`,
							typeId: socialMediaType.id,
							url: link.href,
							duration: {
								start: new Date(Date.UTC(1900, 0, 1)),
							},
						})
						.returning({ id: schema.socialMedia.id });

					assert(kbSocialMedia);

					await tx.insert(schema.personsToSocialMedia).values({
						personId: kbPerson.id,
						socialMediaId: kbSocialMedia.id,
					});
				}
			});
		}
	}
	/** Migrate events */

	log.info("Migrating events...");

	const eventsResponse = await fetch(`${apiBaseUrl}/api/data/events`, {});
	const events = (await eventsResponse.json()) as Array<Event>;

	for (const event of events) {
		const eventEN = event.en;
		assert(eventEN?.title);
		const eventTitle =
			eventEN.title === "CLARIAH-AT Roadshow"
				? `CLARIAH-AT Roadshow ${eventEN.date?.slice(0, 4) ?? "duplicated"}`
				: eventEN.title;
		const slug = slugify(eventTitle);

		let eventDuration = {
			start: new Date(Date.UTC(1900, 0, 1)),
		};
		let eventLocation = "";

		if (eventEN.summary != null) {
			({ duration: eventDuration, location: eventLocation } = parseEventSummary(eventEN.summary));
		}
		await db.transaction(async (tx) => {
			const { documentId: _eventDocumentId, versionId: eventVersionId } =
				await createPublishedDocument(tx, entityTypesByType.events.id, slug);

			let asset;
			if (eventEN.image != null) {
				const imageUrl = new URL(`${assetsGithubPath}${eventEN.image}`);
				const imageResponse = await fetch(imageUrl, { method: "HEAD" });
				const size = Number(imageResponse.headers.get("content-length"));
				if (size > assetSizeLimit) {
					logToFile(`image too big. resize and upload manually. ${String(imageUrl)}`);
				} else {
					try {
						const input = await buffer.fromUrl(imageUrl);
						const metadata = await buffer.getMetadata(input);
						const prefix = "images" as AssetPrefix;
						const label = eventEN.title!;
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
					} catch (error: unknown) {
						if (Error.isError(error)) {
							logToFile(`${error.message} ${String(imageUrl)}`);
						} else {
							logToFile(`unknown error for:  ${String(imageUrl)}`);
						}
					}
				}
			}
			assert(placeholderAsset);

			await tx.insert(schema.events).values({
				id: eventVersionId,
				title: eventEN.title!,
				summary: eventEN.summary ?? "",
				imageId: asset?.id ?? placeholderAsset.id,
				location: eventLocation,
				duration: eventDuration,
				createdAt: eventEN.date != null ? new Date(eventEN.date) : new Date(Date.now()),
			});

			if (eventEN.description != null) {
				const content = generateJSON(eventEN.description, [StarterKit]);

				const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
					where: {
						entityTypeId: entityTypesByType.events.id,
						fieldName: "content",
					},
				});

				assert(fieldName);

				const [field] = await tx
					.insert(schema.fields)
					.values({
						entityVersionId: eventVersionId,
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
		});
	}
	/** Migrate news */

	log.info("Migrating news...");

	const newsResponse = await fetch(`${apiBaseUrl}/api/data/news`, {});
	const news = (await newsResponse.json()) as Array<NewsItem>;

	for (const newsItem of news) {
		const newsItemEN = newsItem.en;
		assert(newsItemEN?.title);
		const newsItemTitle = newsItemEN.title;
		const slug = slugify(newsItemTitle);

		await db.transaction(async (tx) => {
			const { documentId: _newsItemDocumentId, versionId: newsItemVersionId } =
				await createPublishedDocument(tx, entityTypesByType.news.id, slug);

			let asset;
			if (newsItemEN.image != null) {
				const imageUrl = new URL(`${assetsGithubPath}${newsItemEN.image}`);
				const imageResponse = await fetch(imageUrl, { method: "HEAD" });
				const size = Number(imageResponse.headers.get("content-length"));
				if (size > assetSizeLimit) {
					logToFile(`image too big. resize and upload manually. ${String(imageUrl)}`);
				} else {
					const input = await buffer.fromUrl(imageUrl);
					const metadata = await buffer.getMetadata(input);
					const prefix = "images" as AssetPrefix;
					const label = newsItemEN.title!;
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
			}
			assert(placeholderAsset);

			await tx.insert(schema.news).values({
				id: newsItemVersionId,
				title: newsItemEN.title!,
				summary: newsItemEN.summary ?? "",
				imageId: asset?.id ?? placeholderAsset.id,
				createdAt: newsItemEN.date != null ? new Date(newsItemEN.date) : new Date(Date.now()),
			});

			if (newsItemEN.description != null) {
				const content = generateJSON(newsItemEN.description, [StarterKit]);

				const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
					where: {
						entityTypeId: entityTypesByType.news.id,
						fieldName: "content",
					},
				});

				assert(fieldName);

				const [field] = await tx
					.insert(schema.fields)
					.values({
						entityVersionId: newsItemVersionId,
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
		});
	}

	/** Migrate projects */

	log.info("Migrating projects...");

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

			let asset;
			if (projectEN.image != null) {
				const imageUrl = new URL(`${assetsGithubPath}${projectEN.image}`);
				const imageResponse = await fetch(imageUrl, { method: "HEAD" });
				const size = Number(imageResponse.headers.get("content-length"));
				if (size > assetSizeLimit) {
					logToFile(`image too big. resize and upload manually. ${String(imageUrl)}`);
				} else {
					try {
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
					} catch (error: unknown) {
						if (Error.isError(error)) {
							logToFile(`${error.message} ${String(imageUrl)}`);
						} else {
							logToFile(`unknown error for:  ${String(imageUrl)}`);
						}
					}
				}
			}
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
				acronym: null,
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
					personDocumentId = personDocIdBySlug;
				} else {
					const { documentId, versionId } = await createPublishedDocument(
						tx,
						entityTypesByType.persons.id,
						slug,
					);
					personSlugDocumentIds.set(slug, documentId);

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
				const institutionDocIdBySlug = organisationalUnitsSlugDocumentIds.get(slug);

				let institutionDocumentId: string;

				if (institutionDocIdBySlug != null) {
					institutionDocumentId = institutionDocIdBySlug;
				} else {
					const { documentId, versionId } = await createPublishedDocument(
						tx,
						entityTypesByType.organisational_units.id,
						slug,
					);
					organisationalUnitsSlugDocumentIds.set(slug, documentId);
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
			}
		});
	}

	/** Migrate pages */

	log.info("Migrating pages...");

	const pagesResponse = await fetch(`${apiBaseUrl}/api/data/pages`, {});
	const pages = (await pagesResponse.json()) as Array<Page>;

	for (const page of pages) {
		const pageEN = page.en;
		assert(pageEN?.title);
		const pageTitle = pageEN.title;
		const slug = slugify(pageTitle);

		await db.transaction(async (tx) => {
			const { documentId: _pageDocumentId, versionId: pageVersionId } =
				await createPublishedDocument(tx, entityTypesByType.pages.id, slug);

			let asset;
			if (pageEN.image != null) {
				const imageUrl = new URL(`${assetsGithubPath}${pageEN.image}`);
				const imageResponse = await fetch(imageUrl, { method: "HEAD" });
				const size = Number(imageResponse.headers.get("content-length"));
				if (size > assetSizeLimit) {
					logToFile(`image too big. resize and upload manually. ${String(imageUrl)}`);
				} else {
					const input = await buffer.fromUrl(imageUrl);
					const metadata = await buffer.getMetadata(input);
					const prefix = "images" as AssetPrefix;
					const label = pageEN.title!;
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
			}
			assert(placeholderAsset);

			await tx.insert(schema.pages).values({
				id: pageVersionId,
				title: pageEN.title!,
				summary: pageEN.summary ?? "",
				imageId: asset?.id ?? placeholderAsset.id,
			});

			if (pageEN.content != null) {
				const content = generateJSON(pageEN.content, [StarterKit]);

				const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
					where: {
						entityTypeId: entityTypesByType.pages.id,
						fieldName: "content",
					},
				});

				assert(fieldName);

				const [field] = await tx
					.insert(schema.fields)
					.values({
						entityVersionId: pageVersionId,
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
