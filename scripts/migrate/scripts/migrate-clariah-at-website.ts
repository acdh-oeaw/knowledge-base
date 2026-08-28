import path from "node:path";

import { assert, keyBy, log } from "@acdh-oeaw/lib";
import { and, createDatabaseService, eq, schema } from "@dariah-eric/database";
import { createStorageService } from "@dariah-eric/storage";
import { buffer } from "@dariah-eric/storage/lib";
import slugify from "@sindresorhus/slugify";

import { apiBaseUrl } from "../config/data-migration.config";
import { env } from "../config/env.config";
import {
	addSocialMediaRelationForOrganisationalUnit,
	addSocialMediaRelationForPerson,
	createAsset,
	createFieldAndContentBlock,
	createPublishedDocument,
	createSortName,
	createVersion,
	parseEventSummary,
} from "../src/lib/utils";

type Locale = "en" | "de";

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

type Institution = Record<Locale, ClariahATWebsiteInstitution | null>;

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

type Event = Record<Locale, ClariahATEvent | null>;

interface ClariahATNewsItem {
	title?: string;
	date?: string | null;
	image?: string;
	shortTitle?: string;
	summary?: string;
	description: string | null;
}

type NewsItem = Record<Locale, ClariahATNewsItem | null>;

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

type Project = Record<Locale, ClariahATProject | null>;

interface ClariahATPage {
	title?: string;
	image?: string;
	shortTitle?: string;
	summary?: string;
	content: string | null;
}

type Page = Record<Locale, ClariahATPage | null>;

// key for a slug index that's aware of which locale a slug was published
// under, since the same institution's slug differs per locale (translated
// names) but its default-locale-only slug isn't enough to recognize a
// reused institution when a non-default-locale name is what actually matches.
function localeSlugKey(localeId: string, slug: string): string {
	return `${localeId}::${slug}`;
}

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

	const personSocialMediaTypes = await db.query.personSocialMediaTypes.findMany();
	const personSocialMediaTypesByType = keyBy(personSocialMediaTypes, (item) => item.type);

	const personSlugDocumentIds = new Map<string, string>();
	const personLocaleSlugDocumentIds = new Map<string, string>();
	const organisationalUnitsSlugDocumentIds = new Map<string, string>();
	const organisationalUnitsLocaleSlugDocumentIds = new Map<string, string>();

	const contentBlockTypes = await db.query.contentBlockTypes.findMany();
	const contentBlockTypesByType = keyBy(contentBlockTypes, (item) => item.type);

	const personSlugVersionedLocaleIds = new Map<string, Set<string>>();
	const organisationalUnitsSlugVersionedLocaleIds = new Map<string, Set<string>>();

	const placeholderInput = await buffer.fromFilePath(
		path.join(process.cwd(), "scripts", "logo-clariah-at.svg"),
	);
	const placeholderMetadata = await buffer.getMetadata(placeholderInput);

	const entityTypes = await db.query.entityTypes.findMany();
	const entityTypesByType = keyBy(entityTypes, (item) => item.type);

	const locales = await db.query.locales.findMany({
		orderBy: (t, { desc }) => [desc(t.isDefault)],
	});
	const localesByLanguageCode = keyBy(locales, (item) => item.languageCode);

	const defaultLocale = locales.find((l) => l.isDefault);

	assert(defaultLocale, "locale not found — run seed-cms first.");

	const localeDE = localesByLanguageCode.de;

	assert(localeDE, "locale not found — run seed-cms first.");

	const defaultLocaleId = defaultLocale.id;
	const localeDEId = localeDE.id;

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

	assert(placeholderAsset);

	const orgUnitTypeId = entityTypesByType.organisational_units.id;

	const [dariahEuDoc] = await db
		.select({ id: schema.slugs.entityId })
		.from(schema.slugs)
		.where(
			and(
				eq(schema.slugs.typeId, orgUnitTypeId),
				eq(schema.slugs.localeId, defaultLocaleId),
				eq(schema.slugs.value, "dariah-eu"),
			),
		);

	assert(dariahEuDoc);

	const [dariahEuDocDE] = await db
		.select({ id: schema.slugs.entityId })
		.from(schema.slugs)
		.where(
			and(
				eq(schema.slugs.typeId, orgUnitTypeId),
				eq(schema.slugs.localeId, localeDEId),
				eq(schema.slugs.value, "dariah-eu"),
			),
		);

	assert(dariahEuDocDE);

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

	let countryVersionDEId: string;

	/** Create country Austria * */

	await db.transaction(async (tx) => {
		({ documentId: countryDocumentId, versionId: countryVersionId } = await createPublishedDocument(
			tx,
			entityTypesByType.organisational_units.id,
			"austria",
			defaultLocale.id,
		));

		countryVersionDEId = await createVersion(
			tx,
			entityTypesByType.organisational_units.id,
			"oesterreich",
			countryDocumentId,
			localeDE.id,
		);

		organisationalUnitsLocaleSlugDocumentIds.set(
			localeSlugKey(defaultLocale.id, "austria"),
			countryDocumentId,
		);
		organisationalUnitsLocaleSlugDocumentIds.set(
			localeSlugKey(localeDE.id, "oesterreich"),
			countryDocumentId,
		);

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

		const [countryOrgUnitDE] = await tx
			.insert(schema.organisationalUnits)
			.values({
				id: countryVersionDEId,
				acronym: "at",
				name: "Österreich",
				summary: "",
				typeId: organisationalUnitTypesByType.country.id,
			})
			.returning({ id: schema.organisationalUnits.id });

		/** Create national consortium CLARIAH-AT * */

		const { documentId: ncDocumentId, versionId: ncVersionId } = await createPublishedDocument(
			tx,
			entityTypesByType.organisational_units.id,
			"clariah-at",
			defaultLocaleId,
		);

		const versionIdDE = await createVersion(
			tx,
			entityTypesByType.organisational_units.id,
			"clariah-at",
			ncDocumentId,
			localeDE.id,
		);

		organisationalUnitsLocaleSlugDocumentIds.set(
			localeSlugKey(defaultLocaleId, "clariah-at"),
			ncDocumentId,
		);
		organisationalUnitsLocaleSlugDocumentIds.set(
			localeSlugKey(localeDE.id, "clariah-at"),
			ncDocumentId,
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

		const [ncOrgUnitDE] = await tx
			.insert(schema.organisationalUnits)
			.values({
				id: versionIdDE,
				name: "CLARIAH-AT",
				sshocMarketplaceActorId: 9403,
				imageId: placeholderAsset.id,
				summary:
					"Ein offenes Netzwerk, das die Anwendung digitaler Methoden in den Geisteswissenschaften und die Entwicklung der entsprechenden Forschungsinfrastrukturen fördert und unterstützt.",
				typeId: organisationalUnitTypesByType.national_consortium.id,
			})
			.returning({ id: schema.organisationalUnits.id });

		assert(countryOrgUnit);
		assert(ncOrgUnit);

		assert(countryOrgUnitDE);
		assert(ncOrgUnitDE);

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
		let institutionDocumentId: string | undefined;
		let institutionVersionId: string | undefined;

		// hoisted above the locale loop so ids created on the default-locale
		// pass are still visible on subsequent locale passes.
		const subInstitutionDocumentIds: Array<string> = [];
		const institutionPeopleDocumentIds: Array<string> = [];

		for (const locale of locales) {
			const l: Locale = locale.languageCode as Locale;
			const institutionData = institution[l];
			assert(institutionData);
			const institutionName = institutionData.name;
			assert(institutionName);
			const slug = slugify(institutionName);

			await db.transaction(async (tx) => {
				if (locale.isDefault) {
					const { documentId, versionId } = await createPublishedDocument(
						tx,
						entityTypesByType.organisational_units.id,
						slug,
						defaultLocaleId,
					);
					institutionDocumentId = documentId;
					institutionVersionId = versionId;
					organisationalUnitsSlugDocumentIds.set(slug, documentId);
					organisationalUnitsLocaleSlugDocumentIds.set(
						localeSlugKey(defaultLocaleId, slug),
						documentId,
					);

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
						relatedUnitDocumentId: countryDocumentId,
						duration: { start: new Date(Date.UTC(1900, 0, 1)) },
						status: organisationalUnitStatusByType.is_located_in.id,
					});
				} else {
					assert(institutionDocumentId, "institution document id missing for locale pass");
					institutionVersionId = await createVersion(
						tx,
						entityTypesByType.organisational_units.id,
						slug,
						institutionDocumentId,
						locale.id,
					);
					organisationalUnitsLocaleSlugDocumentIds.set(
						localeSlugKey(locale.id, slug),
						institutionDocumentId,
					);
				}
				const assetId =
					institutionData.logo != null
						? await createAsset(db, storage, "logos", institutionData.logo, institutionName)
						: undefined;

				const [orgUnit] = await tx
					.insert(schema.organisationalUnits)
					.values({
						id: institutionVersionId,
						name: institutionName,
						summary: "",
						typeId: organisationalUnitTypesByType.institution.id,
						imageId: assetId ?? placeholderAsset.id,
					})
					.returning({ id: schema.organisationalUnits.id });

				await createFieldAndContentBlock(
					tx,
					institutionData.description,
					entityTypesByType.organisational_units.id,
					"description",
					institutionVersionId,
					contentBlockTypesByType.rich_text,
				);

				if (institutionData.href != null) {
					assert(orgUnit);
					await addSocialMediaRelationForOrganisationalUnit(
						tx,
						`${institutionName} Website`,
						socialMediaTypesByType.website.id,
						institutionData.href,
						orgUnit.id,
					);
				}
			});

			for (const [index, subInstitution] of institutionData.institutions.entries()) {
				const slug = slugify(subInstitution.name);
				let subInstitutionVersionId: string;

				await db.transaction(async (tx) => {
					let subInstitutionDocumentId: string;

					if (locale.isDefault) {
						const { documentId, versionId } = await createPublishedDocument(
							tx,
							entityTypesByType.organisational_units.id,
							slug,
							defaultLocaleId,
						);
						subInstitutionDocumentId = documentId;
						subInstitutionVersionId = versionId;
						// remember this document id, keyed by position, for the next locale pass
						subInstitutionDocumentIds[index] = documentId;
						organisationalUnitsSlugDocumentIds.set(slug, documentId);
						organisationalUnitsLocaleSlugDocumentIds.set(
							localeSlugKey(defaultLocaleId, slug),
							documentId,
						);

						await tx.insert(schema.organisationalUnitsRelations).values({
							unitDocumentId: subInstitutionDocumentId,
							relatedUnitDocumentId: dariahEuDocId,
							duration: {
								start: new Date(Date.UTC(1900, 0, 1)),
							},
							status: organisationalUnitStatusByType.is_partner_institution_of.id,
						});

						assert(institutionDocumentId);

						await tx.insert(schema.organisationalUnitsRelations).values({
							unitDocumentId: subInstitutionDocumentId,
							relatedUnitDocumentId: institutionDocumentId,
							duration: {
								start: new Date(Date.UTC(1900, 0, 1)),
							},
							status: organisationalUnitStatusByType.is_part_of.id,
						});

						assert(countryDocumentId);

						await tx.insert(schema.organisationalUnitsRelations).values({
							unitDocumentId: subInstitutionDocumentId,
							relatedUnitDocumentId: countryDocumentId,
							duration: { start: new Date(Date.UTC(1900, 0, 1)) },
							status: organisationalUnitStatusByType.is_located_in.id,
						});
					} else {
						// read back the id remembered from the default-locale pass
						subInstitutionDocumentId = subInstitutionDocumentIds[index]!;
						assert(subInstitutionDocumentId, "sub-institution document id missing for locale pass");
						subInstitutionVersionId = await createVersion(
							tx,
							entityTypesByType.organisational_units.id,
							slug,
							subInstitutionDocumentId,
							locale.id,
						);
						organisationalUnitsLocaleSlugDocumentIds.set(
							localeSlugKey(locale.id, slug),
							subInstitutionDocumentId,
						);
					}

					const assetId = subInstitution.logo
						? await createAsset(db, storage, "logos", subInstitution.logo, subInstitution.name)
						: undefined;

					const [orgUnit] = await tx
						.insert(schema.organisationalUnits)
						.values({
							id: subInstitutionVersionId,
							name: subInstitution.name,
							summary: "",
							typeId: organisationalUnitTypesByType.institution.id,
							imageId: assetId ?? placeholderAsset.id,
						})
						.returning({ id: schema.organisationalUnits.id });

					assert(orgUnit);

					await addSocialMediaRelationForOrganisationalUnit(
						tx,
						`${institutionName} Website`,
						socialMediaTypesByType.website.id,
						subInstitution.href,
						orgUnit.id,
					);
				});
			}

			for (const [index, person] of institutionData.people.entries()) {
				const slug = slugify(person.name);
				let personVersionId: string;

				await db.transaction(async (tx) => {
					let personDocumentId: string;

					if (locale.isDefault) {
						const { documentId, versionId } = await createPublishedDocument(
							tx,
							entityTypesByType.persons.id,
							slug,
							defaultLocaleId,
						);
						personDocumentId = documentId;
						personVersionId = versionId;
						// remember this document id, keyed by position, for the next locale pass
						institutionPeopleDocumentIds[index] = documentId;
						personSlugDocumentIds.set(slug, documentId);
						personLocaleSlugDocumentIds.set(localeSlugKey(defaultLocaleId, slug), documentId);

						assert(institutionDocumentId);

						await tx.insert(schema.personsToOrganisationalUnits).values({
							personDocumentId,
							organisationalUnitDocumentId: institutionDocumentId,
							duration: { start: new Date(Date.UTC(1900, 0, 1)) },
							roleTypeId: personRoleTypesByType.is_affiliated_with.id,
						});
					} else {
						// read back the id remembered from the default-locale pass
						personDocumentId = institutionPeopleDocumentIds[index]!;
						assert(personDocumentId, "person document id missing for locale pass");
						personVersionId = await createVersion(
							tx,
							entityTypesByType.persons.id,
							slug,
							personDocumentId,
							locale.id,
						);
						personLocaleSlugDocumentIds.set(localeSlugKey(locale.id, slug), personDocumentId);
					}

					const assetId = person.image
						? await createAsset(db, storage, "avatars", person.image, person.name)
						: undefined;

					const [kbPerson] = await tx
						.insert(schema.persons)
						.values({
							id: personVersionId,
							name: person.name,
							sortName: createSortName(person.name),
							imageId: assetId ?? placeholderAsset.id,
						})
						.returning({ id: schema.persons.id });

					assert(kbPerson);

					if (person.description != null) {
						await createFieldAndContentBlock(
							tx,
							person.description,
							entityTypesByType.persons.id,
							"biography",
							personVersionId,
							contentBlockTypesByType.rich_text,
						);
					}

					for (const link of person.links) {
						const socialMediaType =
							personSocialMediaTypesByType[
								link.kind as keyof typeof personSocialMediaTypesByType
							] ?? personSocialMediaTypesByType.other;

						await addSocialMediaRelationForPerson(
							tx,
							`${person.name} ${socialMediaType.type}`,
							socialMediaType.id,
							link.href,
							kbPerson.id,
						);
					}
				});
			}
		}

		// After the locale loop, this institution — and every sub-institution and
		// person created for it above — has a version for every locale. Register
		// all of them so the projects phase never tries to create another
		// version/document for something that already exists in every locale.
		assert(institutionDocumentId, "institution document id missing after locale loop");
		organisationalUnitsSlugVersionedLocaleIds.set(
			institutionDocumentId,
			new Set(locales.map((l) => l.id)),
		);

		for (const subInstitutionDocumentId of subInstitutionDocumentIds) {
			if (subInstitutionDocumentId != null) {
				organisationalUnitsSlugVersionedLocaleIds.set(
					subInstitutionDocumentId,
					new Set(locales.map((l) => l.id)),
				);
			}
		}

		for (const institutionPersonDocumentId of institutionPeopleDocumentIds) {
			if (institutionPersonDocumentId != null) {
				personSlugVersionedLocaleIds.set(
					institutionPersonDocumentId,
					new Set(locales.map((l) => l.id)),
				);
			}
		}
	}
	/** Migrate events */

	log.info("Migrating events...");

	const eventsResponse = await fetch(`${apiBaseUrl}/api/data/events`, {});
	const events = (await eventsResponse.json()) as Array<Event>;

	for (const event of events) {
		let eventDocumentId: string | undefined;
		for (const locale of locales) {
			const l: Locale = locale.languageCode as Locale;
			const eventData = event[l];
			assert(eventData);
			const eventTitle =
				eventData.title === "CLARIAH-AT Roadshow"
					? `CLARIAH-AT Roadshow ${eventData.date?.slice(0, 4) ?? "duplicated"}`
					: eventData.title;
			assert(eventTitle);
			const slug = slugify(eventTitle);
			let eventVersionId: string;
			await db.transaction(async (tx) => {
				if (locale.isDefault) {
					const { documentId, versionId } = await createPublishedDocument(
						tx,
						entityTypesByType.events.id,
						slug,
						defaultLocaleId,
					);
					eventDocumentId = documentId;
					eventVersionId = versionId;
				} else {
					assert(eventDocumentId, "event document id missing for locale pass");
					eventVersionId = await createVersion(
						tx,
						entityTypesByType.events.id,
						slug,
						eventDocumentId,
						locale.id,
					);
				}
				const assetId =
					eventData.image != null
						? await createAsset(db, storage, "images", eventData.image, eventTitle)
						: undefined;

				let eventDuration = {
					start: new Date(Date.UTC(1900, 0, 1)),
				};
				let eventLocation = "";

				if (eventData.summary != null) {
					({ duration: eventDuration, location: eventLocation } = parseEventSummary(
						eventData.summary,
					));
				}
				await tx.insert(schema.events).values({
					id: eventVersionId,
					title: eventTitle,
					summary: eventData.summary ?? "",
					imageId: assetId ?? placeholderAsset.id,
					location: eventLocation,
					duration: eventDuration,
					createdAt: eventData.date != null ? new Date(eventData.date) : new Date(Date.now()),
				});

				await createFieldAndContentBlock(
					tx,
					eventData.description,
					entityTypesByType.events.id,
					"content",
					eventVersionId,
					contentBlockTypesByType.rich_text,
				);
			});
		}
	}
	/** Migrate news */

	log.info("Migrating news...");

	const newsResponse = await fetch(`${apiBaseUrl}/api/data/news`, {});
	const news = (await newsResponse.json()) as Array<NewsItem>;

	for (const newsItem of news) {
		let newsItemDocumentId: string | undefined;
		for (const locale of locales) {
			const l: Locale = locale.languageCode as Locale;
			const newsItemData = newsItem[l];
			assert(newsItemData);
			const newsItemTitle = newsItemData.title;
			assert(newsItemTitle);
			const slug = slugify(newsItemTitle);
			let newsItemVersionId: string;
			await db.transaction(async (tx) => {
				if (locale.isDefault) {
					const { documentId, versionId } = await createPublishedDocument(
						tx,
						entityTypesByType.news.id,
						slug,
						defaultLocaleId,
					);
					newsItemDocumentId = documentId;
					newsItemVersionId = versionId;
				} else {
					assert(newsItemDocumentId, "news item document id missing for locale pass");
					newsItemVersionId = await createVersion(
						tx,
						entityTypesByType.news.id,
						slug,
						newsItemDocumentId,
						locale.id,
					);
				}
				const assetId =
					newsItemData.image != null
						? await createAsset(db, storage, "images", newsItemData.image, newsItemTitle)
						: undefined;

				await tx.insert(schema.news).values({
					id: newsItemVersionId,
					title: newsItemTitle,
					summary: newsItemData.summary ?? "",
					imageId: assetId ?? placeholderAsset.id,
					publicationDate:
						newsItemData.date != null ? new Date(newsItemData.date) : new Date(Date.now()),
				});

				await createFieldAndContentBlock(
					tx,
					newsItemData.description,
					entityTypesByType.news.id,
					"content",
					newsItemVersionId,
					contentBlockTypesByType.rich_text,
				);
			});
		}
	}

	/** Migrate projects */

	log.info("Migrating projects...");

	const projectsResponse = await fetch(`${apiBaseUrl}/api/data/projects`, {});
	const projects = (await projectsResponse.json()) as Array<Project>;

	for (const project of projects) {
		let projectDocumentId: string | undefined;

		// NEW: resolved once (on whichever locale pass resolves it first — normally
		// the default locale, since locales are ordered default-first), then reused
		// on every subsequent locale pass for this project, regardless of what name
		// string that locale's payload uses for the same person/institution.
		const responsiblePersonDocumentIds: Array<string> = [];
		const hostingOrganizationDocumentIds: Array<string> = [];

		// Resolve hosting organizations against every locale's name up front,
		// not just the name in whichever locale pass runs first. A project's
		// hosting-organization label can differ slightly from the institution's
		// canonical name in one locale while matching exactly in another (e.g.
		// the German name is written identically elsewhere but the English one
		// isn't). Checking only the current locale's slug per pass previously
		// let the script create a duplicate institution document, which then
		// hit slugs_published_type_locale_value_unique once its other-locale
		// slug collided with the original institution's already-published slug.
		const hostingOrganizationsLength = Math.max(
			0,
			...locales.map(
				(otherLocale) =>
					project[otherLocale.languageCode as Locale]?.hostingOrganizations.length ?? 0,
			),
		);
		for (let index = 0; index < hostingOrganizationsLength; index++) {
			for (const otherLocale of locales) {
				const name = project[otherLocale.languageCode as Locale]?.hostingOrganizations[index];
				if (name == null) {
					continue;
				}
				const existingId = organisationalUnitsLocaleSlugDocumentIds.get(
					localeSlugKey(otherLocale.id, slugify(name)),
				);
				if (existingId != null) {
					hostingOrganizationDocumentIds[index] = existingId;
					break;
				}
			}
		}

		// Same cross-locale pre-resolution as hosting organizations above: a
		// responsible person's name at a given index isn't guaranteed to line
		// up, or even to slug-match, across every locale's array for this
		// project, so check all locales' names for each index before any
		// locale pass has to decide whether it already knows this person.
		const responsiblePersonsLength = Math.max(
			0,
			...locales.map(
				(otherLocale) =>
					project[otherLocale.languageCode as Locale]?.responsiblePersons.length ?? 0,
			),
		);
		for (let index = 0; index < responsiblePersonsLength; index++) {
			for (const otherLocale of locales) {
				const name = project[otherLocale.languageCode as Locale]?.responsiblePersons[index];
				if (name == null) {
					continue;
				}
				const existingId = personLocaleSlugDocumentIds.get(
					localeSlugKey(otherLocale.id, slugify(name)),
				);
				if (existingId != null) {
					responsiblePersonDocumentIds[index] = existingId;
					break;
				}
			}
		}

		for (const locale of locales) {
			const l: Locale = locale.languageCode as Locale;
			const projectData = project[l];
			assert(projectData);
			const projectTitle = projectData.title;
			assert(projectTitle);
			const slug = slugify(projectTitle);
			let projectVersionId: string;
			await db.transaction(async (tx) => {
				if (locale.isDefault) {
					const { documentId, versionId } = await createPublishedDocument(
						tx,
						entityTypesByType.projects.id,
						slug,
						defaultLocaleId,
					);
					projectDocumentId = documentId;
					projectVersionId = versionId;
				} else {
					assert(projectDocumentId, "project document id missing for locale pass");
					projectVersionId = await createVersion(
						tx,
						entityTypesByType.projects.id,
						slug,
						projectDocumentId,
						locale.id,
					);
				}
				const assetId =
					projectData.image != null
						? await createAsset(db, storage, "images", projectData.image, projectTitle)
						: undefined;

				const projectStartDate =
					projectData.startDate != null
						? new Date(
								Date.UTC(
									...(projectData.startDate
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
					projectData.endDate != null
						? new Date(
								Date.UTC(
									...(projectData.endDate
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
					name: projectTitle,
					scopeId: projectScopesByScope.national.id,
					summary: projectData.summary ?? "",
					imageId: assetId ?? placeholderAsset.id,
					duration: {
						start: projectStartDate,
						end: projectEndDate,
					},
					metadata: { tags: projectData.tags },
				});

				await createFieldAndContentBlock(
					tx,
					projectData.description,
					entityTypesByType.projects.id,
					"description",
					projectVersionId,
					contentBlockTypesByType.rich_text,
				);

				/*for (const [index, person] of projectData.responsiblePersons.entries()) {
					// FIX: if we already resolved this position on an earlier locale
					// pass for this project, reuse that id — don't re-derive from name.
					const previouslyResolvedPersonDocumentId = responsiblePersonDocumentIds[index];

					const slug = slugify(person);
					const personDocIdBySlug =
						previouslyResolvedPersonDocumentId ?? personSlugDocumentIds.get(slug);

					let personDocumentId: string;
					let personVersionId: string | undefined = "";
					let needsPersonInsert = false;

					if (personDocIdBySlug != null) {
						personDocumentId = personDocIdBySlug;
						responsiblePersonDocumentIds[index] = personDocumentId;

						const versionedLocaleIds = personSlugVersionedLocaleIds.get(personDocumentId);

						// only true for persons first created in this loop; persons that predate
						// it (e.g. from the institutions migration) already have both locale
						// versions and should be left alone.
						if (versionedLocaleIds != null && !versionedLocaleIds.has(locale.id)) {
							personVersionId = await createVersion(
								tx,
								entityTypesByType.persons.id,
								slug,
								personDocumentId,
								locale.id,
							);
							versionedLocaleIds.add(locale.id);
							needsPersonInsert = true;
						}
					} else {
						// No fallback match on any locale, and no prior resolution for this
						// position — either this is the default-locale pass introducing a
						// new person, or (since responsiblePersons arrays aren't guaranteed
						// to line up 1:1 across locales) this person simply doesn't appear
						// in the default-locale data for this project. Either way, create
						// the document from this locale's own name/slug: `locale.id` equals
						// `defaultLocaleId` on the default-locale pass anyway.
						const { documentId, versionId } = await createPublishedDocument(
							tx,
							entityTypesByType.persons.id,
							slug,
							locale.id,
						);
						personDocumentId = documentId;
						personVersionId = versionId;
						personSlugDocumentIds.set(slug, documentId);
						personLocaleSlugDocumentIds.set(localeSlugKey(locale.id, slug), documentId);
						personSlugVersionedLocaleIds.set(documentId, new Set([locale.id]));
						responsiblePersonDocumentIds[index] = documentId;
						needsPersonInsert = true;
					}

					if (needsPersonInsert) {
						await tx
							.insert(schema.persons)
							.values({
								id: personVersionId,
								name: person,
								sortName: createSortName(person),
							})
							.returning({ id: schema.persons.id });
					}

					await tx
						.insert(schema.projectsToPersons)
						.values({
							projectDocumentId,
							personDocumentId,
							duration: {
								start: projectStartDate,
								end: projectEndDate,
							},
							roleId: projectRolesByRole.affiliated.id,
						})
						.onConflictDoNothing();
				}*/

				for (const [index, institution] of projectData.hostingOrganizations.entries()) {
					// FIX: same pattern — reuse the id resolved on an earlier locale
					// pass for this exact position, instead of re-deriving from name.
					const previouslyResolvedInstitutionDocumentId = hostingOrganizationDocumentIds[index];

					const slug = slugify(institution);
					const institutionDocIdBySlug =
						previouslyResolvedInstitutionDocumentId ?? organisationalUnitsSlugDocumentIds.get(slug);

					let institutionDocumentId: string | undefined = "";
					let institutionVersionId: string | undefined = "";
					let needsInstitutionInsert = false;

					if (institutionDocIdBySlug != null) {
						institutionDocumentId = institutionDocIdBySlug;
						hostingOrganizationDocumentIds[index] = institutionDocumentId;

						const versionedLocaleIds =
							organisationalUnitsSlugVersionedLocaleIds.get(institutionDocumentId);

						if (versionedLocaleIds != null && !versionedLocaleIds.has(locale.id)) {
							institutionVersionId = await createVersion(
								tx,
								entityTypesByType.organisational_units.id,
								slug,
								institutionDocumentId,
								locale.id,
							);
							versionedLocaleIds.add(locale.id);
							needsInstitutionInsert = true;
							organisationalUnitsLocaleSlugDocumentIds.set(
								localeSlugKey(locale.id, slug),
								institutionDocumentId,
							);
						}
					} else {
						if (locale.isDefault) {
							const { documentId, versionId } = await createPublishedDocument(
								tx,
								entityTypesByType.organisational_units.id,
								slug,
								defaultLocaleId,
							);
							institutionDocumentId = documentId;
							institutionVersionId = versionId;
							organisationalUnitsSlugDocumentIds.set(slug, documentId);
							organisationalUnitsSlugVersionedLocaleIds.set(documentId, new Set([locale.id]));
							organisationalUnitsLocaleSlugDocumentIds.set(
								localeSlugKey(defaultLocaleId, slug),
								documentId,
							);
							hostingOrganizationDocumentIds[index] = documentId;
						} else {
							assert(
								false,
								`hosting organization document id missing for locale pass at index ${String(index)}`,
							);
						}
						needsInstitutionInsert = true;
					}

					if (needsInstitutionInsert) {
						await tx
							.insert(schema.organisationalUnits)
							.values({
								id: institutionVersionId,
								name: institution,
								summary: "",
								typeId: organisationalUnitTypesByType.institution.id,
								imageId: placeholderAsset.id,
							})
							.returning({ id: schema.organisationalUnits.id });
					}

					await tx
						.insert(schema.projectsToOrganisationalUnits)
						.values({
							projectDocumentId,
							unitDocumentId: institutionDocumentId,
							duration: {
								start: projectStartDate,
								end: projectEndDate,
							},
							roleId: projectRolesByRole.affiliated.id,
						})
						.onConflictDoNothing();
				}
			});
		}
	}

	/** Migrate pages */

	log.info("Migrating pages...");

	const pagesResponse = await fetch(`${apiBaseUrl}/api/data/pages`, {});
	const pages = (await pagesResponse.json()) as Array<Page>;

	for (const page of pages) {
		let pageDocumentId: string | undefined;
		for (const locale of locales) {
			const l: Locale = locale.languageCode as Locale;
			const pageData = page[l];
			assert(pageData);
			const pageTitle = pageData.title;
			assert(pageTitle);
			const slug = slugify(pageTitle);
			let pageVersionId: string;
			await db.transaction(async (tx) => {
				if (locale.isDefault) {
					const { documentId, versionId } = await createPublishedDocument(
						tx,
						entityTypesByType.pages.id,
						slug,
						defaultLocaleId,
					);
					pageDocumentId = documentId;
					pageVersionId = versionId;
				} else {
					assert(pageDocumentId, "page document id missing for locale pass");
					pageVersionId = await createVersion(
						tx,
						entityTypesByType.pages.id,
						slug,
						pageDocumentId,
						locale.id,
					);
				}
				const assetId =
					pageData.image != null
						? await createAsset(db, storage, "images", pageData.image, pageTitle)
						: undefined;

				await tx.insert(schema.pages).values({
					id: pageVersionId,
					title: pageTitle,
					summary: pageData.summary ?? "",
					imageId: assetId ?? placeholderAsset.id,
					publicationDate: new Date(Date.now()),
				});

				await createFieldAndContentBlock(
					tx,
					pageData.content,
					entityTypesByType.pages.id,
					"content",
					pageVersionId,
					contentBlockTypesByType.rich_text,
				);
			});
		}
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
