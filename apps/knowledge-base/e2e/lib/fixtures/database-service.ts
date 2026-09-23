import { type Transaction, createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, exists, inArray, notExists, or, sql } from "@dariah-eric/database/sql";
import type { InferOk } from "better-result";

import { env } from "../../../config/env.config";

export const E2E_TEST_ASSET_KEY = "images/e2e-test-asset";
export const E2E_TEST_ASSET_LABEL = "E2E Test Asset";

/** Matches the `[e2e-worker-N] …` names every worker gives the fixtures it creates. */
const WORKER_FIXTURE_NAME_PATTERN = "[e2e-worker-%";

type Database = InferOk<ReturnType<typeof createDatabaseService>>;

interface WorkingGroupVersionRow {
	acronym: string | null;
	documentId: string;
	email: string | null;
	id: string;
	imageId: string | null;
	mailingList: string | null;
	name: string;
	sshocMarketplaceActorId: number | null;
	summary: string | null;
}

/**
 * Worker-scoped service that provides DB access and test-data helpers.
 *
 * Each test worker gets its own `DatabaseService` instance (and therefore its own pg pool). Workers
 * inherit env vars from the main Playwright process (which called dotenvx in
 * playwright.config.ts).
 */
export class DatabaseService {
	private readonly db: Database;

	constructor() {
		this.db = createDatabaseService({
			connection: {
				database: env.DATABASE_NAME,
				host: env.DATABASE_HOST,
				password: env.DATABASE_PASSWORD,
				port: env.DATABASE_PORT,
				user: env.DATABASE_USER,
			},
			logger: false,
		}).unwrap();
	}

	/** Returns the asset inserted by globalSetup. */
	async getTestAsset(): Promise<{ id: string; key: string }> {
		const asset = await this.db.query.assets.findFirst({
			where: { key: E2E_TEST_ASSET_KEY },
			columns: { id: true, key: true },
		});

		if (asset == null) {
			throw new Error(
				`Test asset "${E2E_TEST_ASSET_KEY}" not found — make sure globalSetup ran successfully.`,
			);
		}

		return asset;
	}

	/**
	 * Entities from the database, formatted as they appear in the "Related entities" MultipleSelect,
	 * deduped by id (a single entity can have several locale slugs) and by resolved display name
	 * (distinct entities occasionally share a title, e.g. "Board of directors").
	 */
	private async getOrderedTestEntities(): Promise<Array<{ id: string; name: string }>> {
		const rows = await this.db
			.select({ id: schema.entities.id, slug: schema.slugs.value, label: schema.entities.label })
			.from(schema.entities)
			.innerJoin(
				schema.slugs,
				and(eq(schema.slugs.entityId, schema.entities.id), eq(schema.slugs.isPublished, true)),
			)
			.orderBy(schema.slugs.value);

		const seenIds = new Set<string>();
		const seenNames = new Set<string>();
		const entities: Array<{ id: string; name: string }> = [];

		for (const row of rows) {
			if (seenIds.has(row.id)) {
				continue;
			}
			const name = row.label ?? row.slug;
			if (seenNames.has(name)) {
				continue;
			}
			seenIds.add(row.id);
			seenNames.add(name);
			entities.push({ id: row.id, name });
		}

		return entities;
	}

	/**
	 * Returns an entity to use as a test relation target, formatted as it appears in the "Related
	 * entities" MultipleSelect. `workerIndex` (pass `test.info().workerIndex`) offsets which entity
	 * is picked, with wraparound — tests in different workers run concurrently against the same
	 * shared database, and always handing out the same "first" entity caused cross-worker lock
	 * contention (and occasional deadlocks) when several workers wrote relations onto it at once.
	 */
	async getTestEntity(workerIndex = 0): Promise<{ id: string; name: string }> {
		const entities = await this.getOrderedTestEntities();

		if (entities.length === 0) {
			throw new Error("No entities found in database — required for relation tests.");
		}

		return entities[workerIndex % entities.length]!;
	}

	async getTestEntities(
		count: number,
		workerIndex = 0,
	): Promise<Array<{ id: string; name: string }>> {
		const entities = await this.getOrderedTestEntities();

		if (entities.length < count) {
			throw new Error(`Expected at least ${String(count)} entities for relation tests.`);
		}

		const offset = workerIndex % entities.length;

		return Array.from(
			{ length: count },
			(_, index) => entities[(offset + index) % entities.length]!,
		);
	}

	async getTestResources(count: number): Promise<Array<{ id: string; name: string }>> {
		const { search } = await import("../../../lib/search");
		const result = await search.collections.resources.search({
			query: "*",
			queryBy: ["label"],
			sortBy: [{ field: "label", direction: "asc" }],
			perPage: count,
		});

		if (result.isErr()) {
			throw result.error;
		}

		const resources = result.value.items.map((hit) => {
			return { id: hit.document.id, name: hit.document.label };
		});

		if (resources.length < count) {
			throw new Error("Not enough resources found in search index — required for relation tests.");
		}

		return resources;
	}

	/**
	 * Returns published news items (id = published version id, matching what the featured-items
	 * picker uses) ordered by title, the same order as the picker's first page.
	 */
	async getPublishedNewsItems(count: number): Promise<Array<{ id: string; name: string }>> {
		const rows = await this.db
			.select({ id: schema.news.id, name: schema.news.title })
			.from(schema.news)
			.innerJoin(schema.entityVersions, eq(schema.news.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(eq(schema.entityStatus.type, "published"))
			.orderBy(schema.news.title)
			.limit(count);

		if (rows.length < count) {
			throw new Error(
				`Expected at least ${String(count)} published news items for featured tests.`,
			);
		}

		return rows;
	}

	/**
	 * Returns published events (id = published version id, matching what the featured-items picker
	 * uses) ordered by title, the same order as the picker's first page.
	 */
	async getPublishedEvents(count: number): Promise<Array<{ id: string; name: string }>> {
		const rows = await this.db
			.select({ id: schema.events.id, name: schema.events.title })
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(eq(schema.entityStatus.type, "published"))
			.orderBy(schema.events.title)
			.limit(count);

		if (rows.length < count) {
			throw new Error(`Expected at least ${String(count)} published events for featured tests.`);
		}

		return rows;
	}

	/**
	 * Returns published projects (id = published version id, matching what the featured-items picker
	 * uses) ordered by name, the same order as the picker's first page.
	 */
	async getPublishedProjects(count: number): Promise<Array<{ id: string; name: string }>> {
		const rows = await this.db
			.select({ id: schema.projects.id, name: schema.projects.name })
			.from(schema.projects)
			.innerJoin(schema.entityVersions, eq(schema.projects.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(eq(schema.entityStatus.type, "published"))
			.orderBy(schema.projects.name)
			.limit(count);

		if (rows.length < count) {
			throw new Error(`Expected at least ${String(count)} published projects for featured tests.`);
		}

		return rows;
	}

	/**
	 * Reads the singleton site_metadata row's `featuredItemIds`, grouped by entity type (empty lists
	 * when unset).
	 */
	async getSiteMetadataFeaturedItemIds(): Promise<{
		news: Array<string>;
		events: Array<string>;
		projects: Array<string>;
	}> {
		const row = await this.db.query.siteMetadata.findFirst({
			columns: { featuredItemIds: true },
		});

		return {
			news: row?.featuredItemIds?.news ?? [],
			events: row?.featuredItemIds?.events ?? [],
			projects: row?.featuredItemIds?.projects ?? [],
		};
	}

	/**
	 * Upserts the singleton site_metadata row, setting `featuredItemIds` (and ensuring title +
	 * description exist so the form can be saved without filling them). Used to put the page into a
	 * known state before/after the featured-items tests.
	 */
	async resetSiteMetadataFeaturedItems(
		featuredItemIds: {
			news?: Array<string>;
			events?: Array<string>;
			projects?: Array<string>;
		} = {},
	): Promise<void> {
		const value = {
			news: featuredItemIds.news ?? [],
			events: featuredItemIds.events ?? [],
			projects: featuredItemIds.projects ?? [],
		};

		await this.db
			.insert(schema.siteMetadata)
			.values({
				id: 1,
				title: "E2E Site Title",
				description: "E2E Site Description",
				featuredItemIds: value,
			})
			.onConflictDoUpdate({
				target: schema.siteMetadata.id,
				set: { featuredItemIds: value, updatedAt: sql`NOW()` },
			});
	}

	/** Returns related entity and resource IDs for a given entity (by its document DB id). */
	async getEntityRelations(
		entityId: string,
	): Promise<{ relatedEntityIds: Array<string>; relatedResourceIds: Array<string> }> {
		const [entityRows, resourceRows] = await Promise.all([
			this.db
				.select({ relatedEntityId: schema.entitiesToEntities.relatedEntityId })
				.from(schema.entitiesToEntities)
				.where(eq(schema.entitiesToEntities.entityId, entityId))
				.orderBy(schema.entitiesToEntities.position),
			this.db
				.select({ resourceId: schema.entitiesToResources.resourceId })
				.from(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, entityId))
				.orderBy(schema.entitiesToResources.position),
		]);

		return {
			relatedEntityIds: entityRows.map((r) => r.relatedEntityId),
			relatedResourceIds: resourceRows.map((r) => r.resourceId),
		};
	}

	/** Returns the entitiesToEntities row (including timestamps) for a specific relation. */
	async getEntitiesToEntitiesRow(
		entityId: string,
		relatedEntityId: string,
	): Promise<{ createdAt: Date } | null> {
		const [row] = await this.db
			.select({ createdAt: schema.entitiesToEntities.createdAt })
			.from(schema.entitiesToEntities)
			.where(
				and(
					eq(schema.entitiesToEntities.entityId, entityId),
					eq(schema.entitiesToEntities.relatedEntityId, relatedEntityId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/**
	 * Finds a news item by exact title. Returns the document entity ID (entities.id) so callers can
	 * use it with getEntityRelations / getEntitiesToEntitiesRow.
	 */
	async getNewsItemByTitle(title: string): Promise<{
		documentId: string;
		id: string;
		imageId: string;
		publicationDate: Date;
		summary: string;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				id: schema.entityVersions.entityId,
				imageId: schema.news.imageId,
				publicationDate: schema.news.publicationDate,
				summary: schema.news.summary,
			})
			.from(schema.news)
			.innerJoin(schema.entityVersions, eq(schema.news.id, schema.entityVersions.id))
			.where(eq(schema.news.title, title))
			.limit(1);

		return row ?? null;
	}

	async getAssetByLabel(
		label: string,
	): Promise<{ id: string; key: string; mimeType: string } | null> {
		const asset = await this.db.query.assets.findFirst({
			where: { label },
			columns: { id: true, key: true, mimeType: true },
		});

		return asset ?? null;
	}

	async getNewsContentBlocksByTitle(title: string): Promise<
		Array<{
			accordionItemTitle: string | null;
			blockId: string;
			parentBlockId: string | null;
			calloutIntent: string | null;
			calloutTitle: string | null;
			content: unknown;
			dataLimit: number | null;
			embedTitle: string | null;
			embedUrl: string | null;
			galleryCaption: unknown;
			galleryItems: unknown;
			galleryLayout: string | null;
			heroCtas: unknown;
			heroEyebrow: string | null;
			heroTitle: string | null;
			imageCaptionMode: string | null;
			imageLayout: string | null;
			mediaTextSide: string | null;
			position: number;
			type: string;
		}>
	> {
		const [newsItem] = await this.db
			.select({ versionId: schema.news.id })
			.from(schema.news)
			.where(eq(schema.news.title, title))
			.limit(1);

		if (newsItem == null) {
			return [];
		}

		const rows = await this.db
			.select({
				accordionItemTitle: schema.accordionItemContentBlocks.title,
				blockId: schema.contentBlocks.id,
				parentBlockId: schema.contentBlocks.parentBlockId,
				calloutIntent: schema.calloutContentBlocks.intent,
				calloutTitle: schema.calloutContentBlocks.title,
				content: sql<unknown>`coalesce(${schema.richTextContentBlocks.content}, ${schema.mediaTextContentBlocks.content})`,
				dataLimit: schema.dataContentBlocks.limit,
				embedTitle: schema.embedContentBlocks.title,
				embedUrl: schema.embedContentBlocks.url,
				/** The gallery's own caption, on its row — its items' captions are aggregated below. */
				galleryCaption: schema.galleryContentBlocks.caption,
				/**
				 * Items live in their own table, one row per image. Aggregated here rather than joined so a
				 * gallery stays one row like every other block type.
				 */
				galleryItems: sql<unknown>`(
					select coalesce(
						json_agg(
							json_build_object(
								'caption', ${schema.galleryContentBlockItems.caption},
								'captionMode', ${schema.galleryContentBlockItems.captionMode}
							)
							order by ${schema.galleryContentBlockItems.position}
						),
						'[]'::json
					)
					from ${schema.galleryContentBlockItems}
					where ${schema.galleryContentBlockItems.galleryContentBlockId} = ${schema.contentBlocks.id}
				)`,
				galleryLayout: schema.galleryContentBlocks.layout,
				heroCtas: schema.heroContentBlocks.ctas,
				heroEyebrow: schema.heroContentBlocks.eyebrow,
				heroTitle: schema.heroContentBlocks.title,
				imageCaptionMode: schema.imageContentBlocks.captionMode,
				imageLayout: schema.imageContentBlocks.layout,
				mediaTextSide: schema.mediaTextContentBlocks.side,
				position: schema.contentBlocks.position,
				type: schema.contentBlockTypes.type,
			})
			.from(schema.contentBlocks)
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.contentBlockTypes,
				eq(schema.contentBlocks.typeId, schema.contentBlockTypes.id),
			)
			.leftJoin(
				schema.richTextContentBlocks,
				eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
			)
			.leftJoin(
				schema.calloutContentBlocks,
				eq(schema.calloutContentBlocks.id, schema.contentBlocks.id),
			)
			.leftJoin(
				schema.accordionItemContentBlocks,
				eq(schema.accordionItemContentBlocks.id, schema.contentBlocks.id),
			)
			.leftJoin(
				schema.imageContentBlocks,
				eq(schema.imageContentBlocks.id, schema.contentBlocks.id),
			)
			.leftJoin(
				schema.mediaTextContentBlocks,
				eq(schema.mediaTextContentBlocks.id, schema.contentBlocks.id),
			)
			.leftJoin(
				schema.embedContentBlocks,
				eq(schema.embedContentBlocks.id, schema.contentBlocks.id),
			)
			.leftJoin(
				schema.galleryContentBlocks,
				eq(schema.galleryContentBlocks.id, schema.contentBlocks.id),
			)
			.leftJoin(schema.dataContentBlocks, eq(schema.dataContentBlocks.id, schema.contentBlocks.id))
			.leftJoin(schema.heroContentBlocks, eq(schema.heroContentBlocks.id, schema.contentBlocks.id))
			.leftJoin(
				schema.accordionContentBlocks,
				eq(schema.accordionContentBlocks.id, schema.contentBlocks.id),
			)
			.where(eq(schema.fields.entityVersionId, newsItem.versionId))
			.orderBy(schema.contentBlocks.position);

		return rows;
	}

	async getInstitutionByName(name: string): Promise<{
		acronym: string | null;
		documentId: string;
		id: string;
		imageId: string | null;
		name: string;
		ror: string | null;
		sshocMarketplaceActorId: number | null;
		summary: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				acronym: schema.organisationalUnits.acronym,
				documentId: schema.entityVersions.entityId,
				id: schema.organisationalUnits.id,
				imageId: schema.organisationalUnits.imageId,
				name: schema.organisationalUnits.name,
				ror: schema.organisationalUnits.ror,
				sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
				summary: schema.organisationalUnits.summary,
			})
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					eq(schema.organisationalUnits.name, name),
					eq(schema.organisationalUnitTypes.type, "institution"),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async getInstitutionDescriptionByName(name: string): Promise<unknown> {
		const institution = await this.getInstitutionByName(name);
		if (institution == null) {
			return null;
		}
		return this.getOrganisationalUnitDescriptionByVersionId(institution.id);
	}

	async getInstitutionSocialMediaIdsByName(name: string): Promise<Array<string> | null> {
		const institution = await this.getInstitutionByName(name);
		if (institution == null) {
			return null;
		}

		return this.getOrganisationalUnitSocialMediaIds(institution.id);
	}

	async getOrganisationalUnitSocialMediaIds(versionId: string): Promise<Array<string>> {
		const socialMedia = await this.db
			.select({
				socialMediaId: schema.organisationalUnitsToSocialMedia.socialMediaId,
			})
			.from(schema.organisationalUnitsToSocialMedia)
			.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, versionId))
			.orderBy(schema.organisationalUnitsToSocialMedia.position);

		return socialMedia.map((item) => item.socialMediaId);
	}

	async getCountryByName(name: string): Promise<{
		acronym: string | null;
		documentId: string;
		id: string;
		imageId: string | null;
		name: string;
		summary: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				acronym: schema.organisationalUnits.acronym,
				documentId: schema.entityVersions.entityId,
				id: schema.organisationalUnits.id,
				imageId: schema.organisationalUnits.imageId,
				name: schema.organisationalUnits.name,
				summary: schema.organisationalUnits.summary,
			})
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					eq(schema.organisationalUnits.name, name),
					eq(schema.organisationalUnitTypes.type, "country"),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async getCountryDescriptionByName(name: string): Promise<unknown> {
		const country = await this.getCountryByName(name);
		if (country == null) {
			return null;
		}
		return this.getOrganisationalUnitDescriptionByVersionId(country.id);
	}

	async getGovernanceBodyByName(name: string): Promise<{
		acronym: string | null;
		documentId: string;
		id: string;
		imageId: string | null;
		name: string;
		summary: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				acronym: schema.organisationalUnits.acronym,
				documentId: schema.entityVersions.entityId,
				id: schema.organisationalUnits.id,
				imageId: schema.organisationalUnits.imageId,
				name: schema.organisationalUnits.name,
				summary: schema.organisationalUnits.summary,
			})
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					eq(schema.organisationalUnits.name, name),
					eq(schema.organisationalUnitTypes.type, "governance_body"),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async getGovernanceBodyDescriptionByName(name: string): Promise<unknown> {
		const body = await this.getGovernanceBodyByName(name);
		if (body == null) {
			return null;
		}
		return this.getOrganisationalUnitDescriptionByVersionId(body.id);
	}

	async getNationalConsortiumByName(name: string): Promise<{
		acronym: string | null;
		documentId: string;
		id: string;
		imageId: string | null;
		name: string;
		ror: string | null;
		sshocMarketplaceActorId: number | null;
		summary: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				acronym: schema.organisationalUnits.acronym,
				documentId: schema.entityVersions.entityId,
				id: schema.organisationalUnits.id,
				imageId: schema.organisationalUnits.imageId,
				name: schema.organisationalUnits.name,
				ror: schema.organisationalUnits.ror,
				sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
				summary: schema.organisationalUnits.summary,
			})
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					eq(schema.organisationalUnits.name, name),
					eq(schema.organisationalUnitTypes.type, "national_consortium"),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async getNationalConsortiumDescriptionByName(name: string): Promise<unknown> {
		const consortium = await this.getNationalConsortiumByName(name);
		if (consortium == null) {
			return null;
		}
		return this.getOrganisationalUnitDescriptionByVersionId(consortium.id);
	}

	private async getWorkingGroupByNameAndStatus(
		name: string,
		statusType: "draft" | "published",
	): Promise<WorkingGroupVersionRow | null> {
		const [row] = await this.db
			.select({
				acronym: schema.organisationalUnits.acronym,
				documentId: schema.entityVersions.entityId,
				email: schema.organisationalUnits.email,
				id: schema.organisationalUnits.id,
				imageId: schema.organisationalUnits.imageId,
				mailingList: schema.organisationalUnits.mailingList,
				name: schema.organisationalUnits.name,
				sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
				summary: schema.organisationalUnits.summary,
			})
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					eq(schema.organisationalUnits.name, name),
					eq(schema.organisationalUnitTypes.type, "working_group"),
					eq(schema.entityStatus.type, statusType),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/**
	 * Read the _draft_ working-group version. Save-only (unpublished) admin edits only ever touch the
	 * draft row, so this is what create/edit/relation assertions should read. Use
	 * {@link getPublishedWorkingGroupByName} to assert what a public visitor sees after publishing —
	 * previously this join had no status filter and an unordered `.limit(1)`, so it silently read the
	 * draft and masked bugs that only corrupt the published row (e.g. dropped-column-on-publish).
	 */
	async getWorkingGroupByName(name: string): Promise<WorkingGroupVersionRow | null> {
		return this.getWorkingGroupByNameAndStatus(name, "draft");
	}

	/** Read the _published_ working-group version — what a public visitor sees after publishing. */
	async getPublishedWorkingGroupByName(name: string): Promise<WorkingGroupVersionRow | null> {
		return this.getWorkingGroupByNameAndStatus(name, "published");
	}

	async getWorkingGroupDescriptionByName(name: string): Promise<unknown> {
		const workingGroup = await this.getWorkingGroupByName(name);

		if (workingGroup == null) {
			return null;
		}

		const [row] = await this.db
			.select({ content: sql<unknown>`${schema.richTextContentBlocks.content}` })
			.from(schema.richTextContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.richTextContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(
				and(
					eq(schema.fields.entityVersionId, workingGroup.id),
					eq(schema.entityTypesFieldsNames.fieldName, "description"),
				),
			)
			.limit(1);

		return row?.content ?? null;
	}

	async getPersonRelationsByUnitVersionId(versionId: string): Promise<
		Array<{
			id: string;
			personId: string;
			roleType: string;
			duration: { start: Date; end?: Date };
		}>
	> {
		return this.db
			.select({
				id: schema.personsToOrganisationalUnits.id,
				personId: schema.personsToOrganisationalUnits.personDocumentId,
				roleType: schema.personRoleTypes.type,
				duration: schema.personsToOrganisationalUnits.duration,
			})
			.from(schema.personsToOrganisationalUnits)
			.innerJoin(
				schema.personRoleTypes,
				eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
			)
			.where(
				sql`${schema.personsToOrganisationalUnits.organisationalUnitDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${versionId})`,
			);
	}

	async getContributionsByPersonVersionId(versionId: string): Promise<
		Array<{
			id: string;
			organisationalUnitId: string;
			roleType: string;
			duration: { start: Date; end?: Date };
			description: string | null;
		}>
	> {
		return this.db
			.select({
				id: schema.personsToOrganisationalUnits.id,
				organisationalUnitId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				roleType: schema.personRoleTypes.type,
				duration: schema.personsToOrganisationalUnits.duration,
				description: schema.personsToOrganisationalUnits.description,
			})
			.from(schema.personsToOrganisationalUnits)
			.innerJoin(
				schema.personRoleTypes,
				eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
			)
			.where(
				sql`${schema.personsToOrganisationalUnits.personDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${versionId})`,
			);
	}

	async getUnitRelationsByUnitVersionId(versionId: string): Promise<
		Array<{
			id: string;
			relatedUnitId: string;
			statusType: string;
			duration: { start: Date; end?: Date };
			description: string | null;
		}>
	> {
		return this.db
			.select({
				id: schema.organisationalUnitsRelations.id,
				// resolve the related unit document back to its published version id.
				relatedUnitId: schema.organisationalUnits.id,
				statusType: schema.organisationalUnitStatus.status,
				duration: schema.organisationalUnitsRelations.duration,
				description: schema.organisationalUnitsRelations.description,
			})
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
			)
			.innerJoin(
				schema.documentLifecycle,
				eq(
					schema.documentLifecycle.documentId,
					schema.organisationalUnitsRelations.relatedUnitDocumentId,
				),
			)
			.innerJoin(
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, schema.documentLifecycle.publishedId),
			)
			.where(
				sql`${schema.organisationalUnitsRelations.unitDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${versionId})`,
			);
	}

	/**
	 * Unit relations where `documentId` is the **source** (`unit_document_id`), keyed by document id
	 * so it also resolves relations of a draft-only unit (e.g. a delegated, never-published
	 * institution and its `is_located_in` / partner edges). Returns the raw related-unit document id
	 * and status type.
	 */
	async getUnitRelationsBySourceDocumentId(documentId: string): Promise<
		Array<{
			id: string;
			relatedUnitDocumentId: string;
			statusType: string;
		}>
	> {
		return this.db
			.select({
				id: schema.organisationalUnitsRelations.id,
				relatedUnitDocumentId: schema.organisationalUnitsRelations.relatedUnitDocumentId,
				statusType: schema.organisationalUnitStatus.status,
			})
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
			)
			.where(eq(schema.organisationalUnitsRelations.unitDocumentId, documentId));
	}

	/**
	 * A published country which is (or is not) a member or observer of DARIAH-EU.
	 *
	 * The guided-form tests need both: `countryMembershipRules` requires a partner institution's
	 * country to be a member, so the same wizard run must succeed quietly for one and raise a warning
	 * for the other. Resolved from the data rather than hardcoded, so the tests do not depend on
	 * which countries a given seed happens to contain.
	 */
	async getCountryByDariahMembership(isMember: boolean): Promise<{
		documentId: string;
		name: string;
	} | null> {
		const membership = this.db
			.select({ one: sql`1` })
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
			)
			.innerJoin(
				schema.slugs,
				and(
					eq(schema.slugs.entityId, schema.organisationalUnitsRelations.relatedUnitDocumentId),
					eq(schema.slugs.isPublished, true),
				),
			)
			.where(
				and(
					eq(schema.organisationalUnitsRelations.unitDocumentId, schema.entityVersions.entityId),
					inArray(schema.organisationalUnitStatus.status, ["is_member_of", "is_observer_of"]),
					eq(schema.slugs.value, "dariah-eu"),
				),
			);

		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				name: schema.organisationalUnits.name,
			})
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					eq(schema.organisationalUnitTypes.type, "country"),
					eq(schema.entityStatus.type, "published"),
					isMember ? exists(membership) : notExists(membership),
				),
			)
			.orderBy(schema.organisationalUnits.name)
			.limit(1);

		return row ?? null;
	}

	/**
	 * Ensures a country is recorded as a member of DARIAH-EU, and reports whether it had to create
	 * that relation.
	 *
	 * The kitchen-sink seed hangs its fixtures off a separate `kitchen-sink-eric` unit, so a seeded
	 * database has no country related to `dariah-eu` at all — and every integrity rule is pinned to
	 * that slug. Tests that need the rules to have something to judge therefore establish the
	 * membership themselves and remove it again, rather than depending on seed data that does not
	 * describe DARIAH-EU.
	 */
	async ensureDariahEricMembership(countryDocumentId: string): Promise<string | null> {
		const [eric] = await this.db
			.select({ id: schema.entities.id })
			.from(schema.entities)
			.innerJoin(
				schema.slugs,
				and(eq(schema.slugs.entityId, schema.entities.id), eq(schema.slugs.isPublished, true)),
			)
			.where(eq(schema.slugs.value, "dariah-eu"))
			.limit(1);

		if (eric == null) {
			return null;
		}

		const [status] = await this.db
			.select({ id: schema.organisationalUnitStatus.id })
			.from(schema.organisationalUnitStatus)
			.where(eq(schema.organisationalUnitStatus.status, "is_member_of"))
			.limit(1);

		if (status == null) {
			return null;
		}

		const [existing] = await this.db
			.select({ id: schema.organisationalUnitsRelations.id })
			.from(schema.organisationalUnitsRelations)
			.where(
				and(
					eq(schema.organisationalUnitsRelations.unitDocumentId, countryDocumentId),
					eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, eric.id),
					eq(schema.organisationalUnitsRelations.status, status.id),
				),
			)
			.limit(1);

		if (existing != null) {
			return null;
		}

		const [created] = await this.db
			.insert(schema.organisationalUnitsRelations)
			.values({
				unitDocumentId: countryDocumentId,
				relatedUnitDocumentId: eric.id,
				status: status.id,
				duration: { start: new Date("2000-01-01T00:00:00.000Z") },
			})
			.returning({ id: schema.organisationalUnitsRelations.id });

		return created?.id ?? null;
	}

	async getEntityDocumentIdBySlug(slug: string): Promise<string | null> {
		const [row] = await this.db
			.select({ id: schema.entities.id })
			.from(schema.entities)
			.innerJoin(
				schema.slugs,
				and(eq(schema.slugs.entityId, schema.entities.id), eq(schema.slugs.isPublished, true)),
			)
			.where(eq(schema.slugs.value, slug))
			.limit(1);

		return row?.id ?? null;
	}

	async getFirstPublishedPerson(): Promise<{ documentId: string; name: string } | null> {
		const [row] = await this.db
			.select({ documentId: schema.entityVersions.entityId, name: schema.persons.name })
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
			.where(eq(schema.entityStatus.type, "published"))
			.orderBy(schema.persons.sortName)
			.limit(1);

		return row ?? null;
	}

	/**
	 * A published working group the retire-unit test can close without touching seeded data.
	 *
	 * Retiring a unit ends every relation hanging off it, so the test must own the unit outright —
	 * ending relations on a seeded working group would break the wgchair suite, which depends on its
	 * chair relations still being open.
	 */
	async createPublishedOrganisationalUnit(params: {
		name: string;
		slug: string;
		unitType: (typeof schema.organisationalUnitTypesEnum)[number];
	}): Promise<{ documentId: string; versionId: string }> {
		return this.db.transaction(async (tx) => {
			const [entityType, status, unitType] = await Promise.all([
				tx.query.entityTypes.findFirst({
					where: { type: "organisational_units" },
					columns: { id: true },
				}),
				tx.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
				tx.query.organisationalUnitTypes.findFirst({
					where: { type: params.unitType },
					columns: { id: true },
				}),
			]);

			const locale = await tx.query.locales.findFirst({
				where: { isDefault: true },
				columns: { id: true },
			});

			if (entityType == null || status == null || unitType == null || locale == null) {
				throw new Error(`Missing lookup rows for a "${params.unitType}".`);
			}

			const [document] = await tx
				.insert(schema.entities)
				.values({ typeId: entityType.id })
				.returning({ id: schema.entities.id });
			if (document == null) {
				throw new Error("Failed to insert organisational-unit document.");
			}

			const [version] = await tx
				.insert(schema.entityVersions)
				.values({ entityId: document.id, statusId: status.id, localeId: locale.id })
				.returning({ id: schema.entityVersions.id });
			if (version == null) {
				throw new Error("Failed to insert organisational-unit version.");
			}

			await tx
				.insert(schema.organisationalUnits)
				.values({ id: version.id, name: params.name, typeId: unitType.id });

			await tx.insert(schema.slugs).values({
				entityVersionId: version.id,
				entityId: document.id,
				typeId: entityType.id,
				localeId: locale.id,
				isPublished: true,
				value: params.slug,
			});

			return { documentId: document.id, versionId: version.id };
		});
	}

	async createPublishedWorkingGroup(params: {
		name: string;
		slug: string;
	}): Promise<{ documentId: string; versionId: string }> {
		return this.createPublishedOrganisationalUnit({ ...params, unitType: "working_group" });
	}

	async createPublishedInstitution(params: {
		name: string;
		slug: string;
	}): Promise<{ documentId: string; versionId: string }> {
		return this.createPublishedOrganisationalUnit({ ...params, unitType: "institution" });
	}

	/**
	 * A person the country-role tests own outright.
	 *
	 * The seed has only two published persons and global setup gives them committee relations, so a
	 * test reusing one would land on the wizard's "already recorded" path instead of the one it means
	 * to exercise. Cleaned up by `cleanupWorkerPersons`, which also clears their relations.
	 */
	async createPublishedPerson(params: {
		name: string;
		sortName: string;
		slug: string;
	}): Promise<{ documentId: string; versionId: string }> {
		return this.db.transaction(async (tx) => {
			const [entityType, status, locale] = await Promise.all([
				tx.query.entityTypes.findFirst({ where: { type: "persons" }, columns: { id: true } }),
				tx.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
				tx.query.locales.findFirst({ where: { isDefault: true }, columns: { id: true } }),
			]);

			if (entityType == null || status == null || locale == null) {
				throw new Error("Missing lookup rows for a person.");
			}

			const [document] = await tx
				.insert(schema.entities)
				.values({ typeId: entityType.id })
				.returning({ id: schema.entities.id });
			if (document == null) {
				throw new Error("Failed to insert person document.");
			}

			const [version] = await tx
				.insert(schema.entityVersions)
				.values({ entityId: document.id, statusId: status.id, localeId: locale.id })
				.returning({ id: schema.entityVersions.id });
			if (version == null) {
				throw new Error("Failed to insert person version.");
			}

			await tx
				.insert(schema.persons)
				.values({ id: version.id, name: params.name, sortName: params.sortName });

			await tx.insert(schema.slugs).values({
				entityVersionId: version.id,
				entityId: document.id,
				typeId: entityType.id,
				localeId: locale.id,
				isPublished: true,
				value: params.slug,
			});

			return { documentId: document.id, versionId: version.id };
		});
	}

	/** Every relation a person holds, with the unit resolved — the shape the assertions need. */
	async getPersonRelations(personDocumentId: string): Promise<
		Array<{
			id: string;
			roleType: string;
			unitDocumentId: string;
			unitSlug: string;
			start: Date;
			end: Date | null;
		}>
	> {
		const rows = await this.db
			.select({
				id: schema.personsToOrganisationalUnits.id,
				roleType: schema.personRoleTypes.type,
				unitDocumentId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				unitSlug: schema.slugs.value,
				duration: schema.personsToOrganisationalUnits.duration,
			})
			.from(schema.personsToOrganisationalUnits)
			.innerJoin(
				schema.personRoleTypes,
				eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
			)
			.innerJoin(
				schema.slugs,
				and(
					eq(
						schema.slugs.entityId,
						schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
					),
					eq(schema.slugs.isPublished, true),
				),
			)
			.where(eq(schema.personsToOrganisationalUnits.personDocumentId, personDocumentId));

		return rows.map((row) => {
			return {
				id: row.id,
				roleType: row.roleType,
				unitDocumentId: row.unitDocumentId,
				unitSlug: row.unitSlug,
				start: row.duration.start,
				end: row.duration.end ?? null,
			};
		});
	}

	async addUnitRelation(params: {
		unitDocumentId: string;
		relatedUnitDocumentId: string;
		statusType: (typeof schema.organisationalUnitStatusEnum)[number];
		start: Date;
	}): Promise<string> {
		const [status] = await this.db
			.select({ id: schema.organisationalUnitStatus.id })
			.from(schema.organisationalUnitStatus)
			.where(eq(schema.organisationalUnitStatus.status, params.statusType))
			.limit(1);

		if (status == null) {
			throw new Error(`Missing organisational unit status "${params.statusType}".`);
		}

		const [row] = await this.db
			.insert(schema.organisationalUnitsRelations)
			.values({
				unitDocumentId: params.unitDocumentId,
				relatedUnitDocumentId: params.relatedUnitDocumentId,
				status: status.id,
				duration: { start: params.start },
			})
			.returning({ id: schema.organisationalUnitsRelations.id });

		if (row == null) {
			throw new Error("Failed to insert unit relation.");
		}

		return row.id;
	}

	async addPersonRelation(params: {
		personDocumentId: string;
		organisationalUnitDocumentId: string;
		roleType: (typeof schema.personRoleTypesEnum)[number];
		start: Date;
	}): Promise<string> {
		const [roleType] = await this.db
			.select({ id: schema.personRoleTypes.id })
			.from(schema.personRoleTypes)
			.where(eq(schema.personRoleTypes.type, params.roleType))
			.limit(1);

		if (roleType == null) {
			throw new Error(`Missing person role type "${params.roleType}".`);
		}

		const [row] = await this.db
			.insert(schema.personsToOrganisationalUnits)
			.values({
				personDocumentId: params.personDocumentId,
				organisationalUnitDocumentId: params.organisationalUnitDocumentId,
				roleTypeId: roleType.id,
				duration: { start: params.start },
			})
			.returning({ id: schema.personsToOrganisationalUnits.id });

		if (row == null) {
			throw new Error("Failed to insert person relation.");
		}

		return row.id;
	}

	async getUnitRelationEndById(id: string): Promise<Date | null | undefined> {
		const [row] = await this.db
			.select({ duration: schema.organisationalUnitsRelations.duration })
			.from(schema.organisationalUnitsRelations)
			.where(eq(schema.organisationalUnitsRelations.id, id))
			.limit(1);

		return row == null ? undefined : (row.duration.end ?? null);
	}

	async getPersonRelationEndById(id: string): Promise<Date | null | undefined> {
		const [row] = await this.db
			.select({ duration: schema.personsToOrganisationalUnits.duration })
			.from(schema.personsToOrganisationalUnits)
			.where(eq(schema.personsToOrganisationalUnits.id, id))
			.limit(1);

		return row == null ? undefined : (row.duration.end ?? null);
	}

	/**
	 * Person relations are not removed by `deleteWorkingGroup`, so a test that attaches one must
	 * clear it before the unit goes, or the delete trips the foreign key.
	 */
	async deletePersonRelationById(id: string): Promise<void> {
		await this.db
			.delete(schema.personsToOrganisationalUnits)
			.where(eq(schema.personsToOrganisationalUnits.id, id));
	}

	/** The first published country, whatever its relation to DARIAH-EU. */
	async getFirstPublishedCountry(): Promise<{ documentId: string; name: string } | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				name: schema.organisationalUnits.name,
			})
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					eq(schema.organisationalUnitTypes.type, "country"),
					eq(schema.entityStatus.type, "published"),
				),
			)
			.orderBy(schema.organisationalUnits.name)
			.limit(1);

		return row ?? null;
	}

	async deleteUnitRelationById(id: string): Promise<void> {
		await this.db
			.delete(schema.organisationalUnitsRelations)
			.where(eq(schema.organisationalUnitsRelations.id, id));
	}

	async getPublishedVersionId(documentId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ id: schema.entityVersions.id })
			.from(schema.entityVersions)
			.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
			.where(
				and(
					eq(schema.entityVersions.entityId, documentId),
					eq(schema.entityStatus.type, "published"),
				),
			)
			.limit(1);
		return row?.id ?? null;
	}

	async getFirstInternalPage(): Promise<{
		documentId: string;
		id: string;
		slug: string;
		title: string;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				id: schema.internalPages.id,
				slug: schema.slugs.value,
				title: schema.internalPages.title,
			})
			.from(schema.internalPages)
			.innerJoin(schema.entityVersions, eq(schema.internalPages.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.entityStatus.type, "published"))
			.orderBy(schema.internalPages.title)
			.limit(1);

		return row ?? null;
	}

	async getInternalPageByTitle(title: string): Promise<{
		documentId: string;
		id: string;
		title: string;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				id: schema.internalPages.id,
				title: schema.internalPages.title,
			})
			.from(schema.internalPages)
			.innerJoin(schema.entityVersions, eq(schema.internalPages.id, schema.entityVersions.id))
			.where(eq(schema.internalPages.title, title))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Discards the draft version of an internal page document if one exists. Reverts the page to its
	 * last published state. Used in afterAll to undo edits made during e2e tests.
	 */
	async discardInternalPageDraft(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const [draftRow] = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
				.where(
					and(
						eq(schema.entityVersions.entityId, documentId),
						eq(schema.entityStatus.type, "draft"),
					),
				)
				.limit(1);

			if (draftRow == null) {
				return;
			}

			const draftVersionId = draftRow.id;

			const entityFields = await tx
				.select({ id: schema.fields.id })
				.from(schema.fields)
				.where(eq(schema.fields.entityVersionId, draftVersionId));

			if (entityFields.length > 0) {
				const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
				await tx
					.delete(schema.contentBlocks)
					.where(inArray(schema.contentBlocks.fieldId, fieldIds));
				await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
			}

			await tx.delete(schema.internalPages).where(eq(schema.internalPages.id, draftVersionId));
			await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, draftVersionId));
			await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, draftVersionId));
		});
	}

	async getPersonByName(name: string): Promise<{
		documentId: string;
		email: string | null;
		id: string;
		imageId: string | null;
		name: string;
		orcid: string | null;
		sortName: string;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				email: schema.persons.email,
				id: schema.persons.id,
				imageId: schema.persons.imageId,
				name: schema.persons.name,
				orcid: schema.persons.orcid,
				sortName: schema.persons.sortName,
			})
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.where(eq(schema.persons.name, name))
			.limit(1);

		return row ?? null;
	}

	async getPersonBiographyByName(name: string): Promise<unknown> {
		const person = await this.getPersonByName(name);

		if (person == null) {
			return null;
		}

		const [row] = await this.db
			.select({ content: sql<unknown>`${schema.richTextContentBlocks.content}` })
			.from(schema.richTextContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.richTextContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(
				and(
					eq(schema.fields.entityVersionId, person.id),
					eq(schema.entityTypesFieldsNames.fieldName, "biography"),
				),
			)
			.limit(1);

		return row?.content ?? null;
	}

	async getPersonBiographyContentBlocksByName(
		name: string,
	): Promise<Array<{ type: string; position: number; content: unknown; imageId: string | null }>> {
		const person = await this.getPersonByName(name);

		if (person == null) {
			return [];
		}

		return this.getEntityVersionFieldContentBlocks(person.id, "biography");
	}

	async getSocialMediaByName(name: string): Promise<{
		duration: { start?: Date; end?: Date } | null;
		id: string;
		name: string;
		type: string;
		url: string;
	} | null> {
		const [row] = await this.db
			.select({
				duration: schema.socialMedia.duration,
				id: schema.socialMedia.id,
				name: schema.socialMedia.name,
				type: schema.socialMediaTypes.type,
				url: schema.socialMedia.url,
			})
			.from(schema.socialMedia)
			.innerJoin(schema.socialMediaTypes, eq(schema.socialMedia.typeId, schema.socialMediaTypes.id))
			.where(eq(schema.socialMedia.name, name))
			.limit(1);

		return row ?? null;
	}

	async getProjectByName(name: string): Promise<{
		acronym: string | null;
		callId: string | null;
		documentId: string;
		duration: { start: Date; end?: Date } | null;
		funding: number | null;
		id: string;
		imageId: string | null;
		name: string;
		scopeId: string;
		summary: string | null;
		topic: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				acronym: schema.projects.acronym,
				callId: schema.projects.callId,
				documentId: schema.entityVersions.entityId,
				duration: schema.projects.duration,
				funding: schema.projects.funding,
				id: schema.projects.id,
				imageId: schema.projects.imageId,
				name: schema.projects.name,
				scopeId: schema.projects.scopeId,
				summary: schema.projects.summary,
				topic: schema.projects.topic,
			})
			.from(schema.projects)
			.innerJoin(schema.entityVersions, eq(schema.projects.id, schema.entityVersions.id))
			.where(eq(schema.projects.name, name))
			.limit(1);

		return row ?? null;
	}

	async getProjectRole(): Promise<{ id: string; role: string }> {
		const [role] = await this.db
			.select({ id: schema.projectRoles.id, role: schema.projectRoles.role })
			.from(schema.projectRoles)
			.orderBy(schema.projectRoles.role)
			.limit(1);

		if (role == null) {
			throw new Error("Expected at least one project role for e2e tests.");
		}

		return role;
	}

	async getProjectRelationsByName(name: string): Promise<{
		partners: Array<{
			duration: { start?: Date; end?: Date } | null;
			roleId: string;
			unitDocumentId: string;
		}>;
		affiliations: Array<{
			duration: { start?: Date; end?: Date } | null;
			roleId: string;
			personDocumentId: string;
		}>;
		socialMediaIds: Array<string>;
	} | null> {
		const project = await this.getProjectByName(name);

		if (project == null) {
			return null;
		}

		const partners = await this.db
			.select({
				duration: schema.projectsToOrganisationalUnits.duration,
				roleId: schema.projectsToOrganisationalUnits.roleId,
				unitDocumentId: schema.projectsToOrganisationalUnits.unitDocumentId,
			})
			.from(schema.projectsToOrganisationalUnits)
			.where(
				sql`${schema.projectsToOrganisationalUnits.projectDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${project.id})`,
			);

		const affiliations = await this.db
			.select({
				duration: schema.projectsToPersons.duration,
				roleId: schema.projectsToPersons.roleId,
				personDocumentId: schema.projectsToPersons.personDocumentId,
			})
			.from(schema.projectsToPersons)
			.where(
				sql`${schema.projectsToPersons.projectDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${project.id})`,
			);

		const socialMedia = await this.db
			.select({ socialMediaId: schema.projectsToSocialMedia.socialMediaId })
			.from(schema.projectsToSocialMedia)
			.where(eq(schema.projectsToSocialMedia.projectId, project.id))
			.orderBy(schema.projectsToSocialMedia.position);

		return {
			partners,
			affiliations,
			socialMediaIds: socialMedia.map((item) => item.socialMediaId),
		};
	}

	async getProjectDescriptionByName(name: string): Promise<unknown> {
		const project = await this.getProjectByName(name);

		if (project == null) {
			return null;
		}

		const [row] = await this.db
			.select({ content: sql<unknown>`${schema.richTextContentBlocks.content}` })
			.from(schema.richTextContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.richTextContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(
				and(
					eq(schema.fields.entityVersionId, project.id),
					eq(schema.entityTypesFieldsNames.fieldName, "description"),
				),
			)
			.limit(1);

		return row?.content ?? null;
	}

	async getProjectDescriptionContentBlocksByName(
		name: string,
	): Promise<Array<{ type: string; position: number; content: unknown; imageId: string | null }>> {
		const project = await this.getProjectByName(name);

		if (project == null) {
			return [];
		}

		return this.getEntityVersionFieldContentBlocks(project.id, "description");
	}

	private async getEntityVersionFieldContentBlocks(
		entityVersionId: string,
		fieldName: string,
	): Promise<Array<{ type: string; position: number; content: unknown; imageId: string | null }>> {
		return this.db
			.select({
				content: sql<unknown>`${schema.richTextContentBlocks.content}`,
				imageId: schema.imageContentBlocks.imageId,
				position: schema.contentBlocks.position,
				type: schema.contentBlockTypes.type,
			})
			.from(schema.contentBlocks)
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.innerJoin(
				schema.contentBlockTypes,
				eq(schema.contentBlocks.typeId, schema.contentBlockTypes.id),
			)
			.leftJoin(
				schema.richTextContentBlocks,
				eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
			)
			.leftJoin(
				schema.imageContentBlocks,
				eq(schema.imageContentBlocks.id, schema.contentBlocks.id),
			)
			.where(
				and(
					eq(schema.fields.entityVersionId, entityVersionId),
					eq(schema.entityTypesFieldsNames.fieldName, fieldName),
				),
			)
			.orderBy(schema.contentBlocks.position);
	}

	async getServiceByName(name: string): Promise<{
		comment: string | null;
		dariahBranding: boolean | null;
		id: string;
		metadata: unknown;
		monitoring: boolean | null;
		name: string;
		ownerUnitDocumentIds: Array<string>;
		privateSupplier: boolean | null;
		providerUnitDocumentIds: Array<string>;
		statusId: string;
	} | null> {
		const [row] = await this.db
			.select({
				comment: schema.services.comment,
				dariahBranding: schema.services.dariahBranding,
				id: schema.services.id,
				metadata: schema.services.metadata,
				monitoring: schema.services.monitoring,
				name: schema.services.name,
				privateSupplier: schema.services.privateSupplier,
				statusId: schema.services.statusId,
			})
			.from(schema.services)
			.where(eq(schema.services.name, name))
			.limit(1);

		if (row == null) {
			return null;
		}

		const unitRoleRows = await this.db
			.select({
				organisationalUnitDocumentId:
					schema.servicesToOrganisationalUnits.organisationalUnitDocumentId,
				role: schema.organisationalUnitServiceRoles.role,
			})
			.from(schema.servicesToOrganisationalUnits)
			.innerJoin(
				schema.organisationalUnitServiceRoles,
				eq(schema.servicesToOrganisationalUnits.roleId, schema.organisationalUnitServiceRoles.id),
			)
			.where(eq(schema.servicesToOrganisationalUnits.serviceId, row.id));

		const ownerUnitDocumentIds = unitRoleRows
			.filter((unitRole) => unitRole.role === "service_owner")
			.map((unitRole) => unitRole.organisationalUnitDocumentId);
		const providerUnitDocumentIds = unitRoleRows
			.filter((unitRole) => unitRole.role === "service_provider")
			.map((unitRole) => unitRole.organisationalUnitDocumentId);

		return { ...row, ownerUnitDocumentIds, providerUnitDocumentIds };
	}

	/**
	 * The `get*Option` helpers answer "any published row will do". They must never answer with
	 * another worker's fixture: those are deleted by that worker's afterAll, which can land in the
	 * middle of this test — taking the relation under test with it, or leaving a row this worker
	 * linked to and the other worker can no longer delete. Only seeded rows outlive every worker, and
	 * `[e2e-worker-N] …` names sort ahead of the seeded ones in the default collation, so the
	 * exclusion is load-bearing rather than belt-and-braces.
	 */
	async getOrganisationalUnitOptions(
		limit = 4,
	): Promise<Array<{ documentId: string; name: string }>> {
		return this.db
			.select({
				documentId: schema.entityVersions.entityId,
				name: schema.organisationalUnits.name,
			})
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(
				and(
					eq(schema.entityStatus.type, "published"),
					sql`${schema.organisationalUnits.name} NOT LIKE ${WORKER_FIXTURE_NAME_PATTERN}`,
				),
			)
			.orderBy(schema.organisationalUnits.name)
			.limit(limit);
	}

	/**
	 * Published person documents. `documentId` (not the version id `getPersonOption` returns) is what
	 * document-level relations like `projects_to_persons` key on. See
	 * {@link getOrganisationalUnitOptions} on the exclusion.
	 */
	async getPersonDocumentOptions(limit = 4): Promise<Array<{ documentId: string; name: string }>> {
		return this.db
			.select({
				documentId: schema.entityVersions.entityId,
				name: schema.persons.name,
			})
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(
				and(
					eq(schema.entityStatus.type, "published"),
					sql`${schema.persons.name} NOT LIKE ${WORKER_FIXTURE_NAME_PATTERN}`,
				),
			)
			.orderBy(schema.persons.name)
			.limit(limit);
	}

	/** A seeded published person. See {@link getOrganisationalUnitOptions} on the exclusion. */
	async getPersonOption(): Promise<{ id: string; name: string }> {
		const [row] = await this.db
			.select({ id: schema.persons.id, name: schema.persons.name })
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(
				and(
					eq(schema.entityStatus.type, "published"),
					sql`${schema.persons.name} NOT LIKE ${WORKER_FIXTURE_NAME_PATTERN}`,
				),
			)
			.orderBy(schema.persons.name)
			.limit(1);

		if (row == null) {
			throw new Error("Expected at least one person for e2e tests.");
		}

		return row;
	}

	/**
	 * Published org-unit documents of a given type, ordered by name. `id` is the document id (matches
	 * how reports key their org unit) and `slug` is the document slug used to build reporting URLs.
	 * Seeded rows only — see {@link getOrganisationalUnitOptions}.
	 */
	private async getPublishedOrgUnitOptions(
		unitType: "country" | "working_group",
		limit: number,
	): Promise<Array<{ id: string; name: string; slug: string }>> {
		return this.db
			.select({
				id: schema.entityVersions.entityId,
				name: schema.organisationalUnits.name,
				slug: schema.slugs.value,
			})
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
			.where(
				and(
					eq(schema.organisationalUnitTypes.type, unitType),
					eq(schema.entityStatus.type, "published"),
					sql`${schema.organisationalUnits.name} NOT LIKE ${WORKER_FIXTURE_NAME_PATTERN}`,
				),
			)
			.orderBy(schema.organisationalUnits.name)
			.limit(limit);
	}

	async getCountryOption(): Promise<{ id: string; name: string; slug: string }> {
		const [row] = await this.getPublishedOrgUnitOptions("country", 1);

		if (row == null) {
			throw new Error("Expected at least one country for e2e tests.");
		}

		return row;
	}

	async getWorkingGroupOption(): Promise<{ id: string; name: string; slug: string }> {
		const [row] = await this.getPublishedOrgUnitOptions("working_group", 1);

		if (row == null) {
			throw new Error("Expected at least one working group for e2e tests.");
		}

		return row;
	}

	/**
	 * A published country other than {@link getCountryOption} — used by authz tests to prove that a
	 * persona's relation to one country does not grant access to another.
	 */
	async getOtherCountryOption(): Promise<{ id: string; name: string; slug: string }> {
		const rows = await this.getPublishedOrgUnitOptions("country", 2);

		if (rows[1] == null) {
			throw new Error("Expected at least two countries for cross-tenant authz e2e tests.");
		}

		return rows[1];
	}

	/**
	 * A published working group other than {@link getWorkingGroupOption}. See
	 * {@link getOtherCountryOption}.
	 */
	async getOtherWorkingGroupOption(): Promise<{ id: string; name: string; slug: string }> {
		const rows = await this.getPublishedOrgUnitOptions("working_group", 2);

		if (rows[1] == null) {
			throw new Error("Expected at least two working groups for cross-tenant authz e2e tests.");
		}

		return rows[1];
	}

	async createOpenCampaign(year: number): Promise<{ id: string }> {
		// `year` is unique. A worker's previous run may have crashed before its afterAll ran, leaving a
		// stale campaign (and reports) behind for this deterministic year — clear it first so this call
		// doesn't fail on a duplicate-key conflict against orphaned data.
		const stale = await this.getReportingCampaignByYear(year);
		if (stale != null) {
			await this.deleteReportingCampaign(stale.id);
		}

		const [campaign] = await this.db
			.insert(schema.reportingCampaigns)
			.values({ year, status: "open" })
			.returning({ id: schema.reportingCampaigns.id });

		if (campaign == null) {
			throw new Error(`Failed to create open campaign for year ${String(year)}.`);
		}

		return campaign;
	}

	async getReportingCampaignByYear(
		year: number,
	): Promise<{ id: string; status: string; year: number } | null> {
		const [row] = await this.db
			.select({
				id: schema.reportingCampaigns.id,
				status: schema.reportingCampaigns.status,
				year: schema.reportingCampaigns.year,
			})
			.from(schema.reportingCampaigns)
			.where(eq(schema.reportingCampaigns.year, year))
			.limit(1);

		return row ?? null;
	}

	async getReportingCampaignById(
		id: string,
	): Promise<{ id: string; status: string; year: number } | null> {
		const [row] = await this.db
			.select({
				id: schema.reportingCampaigns.id,
				status: schema.reportingCampaigns.status,
				year: schema.reportingCampaigns.year,
			})
			.from(schema.reportingCampaigns)
			.where(eq(schema.reportingCampaigns.id, id))
			.limit(1);

		return row ?? null;
	}

	async cleanupCampaignSubTables(id: string): Promise<void> {
		const wgReportRows = await this.db
			.select({ id: schema.workingGroupReports.id })
			.from(schema.workingGroupReports)
			.where(eq(schema.workingGroupReports.campaignId, id));

		if (wgReportRows.length > 0) {
			const wgReportIds = wgReportRows.map((r) => r.id);
			await this.db
				.delete(schema.reportScreenComments)
				.where(
					and(
						eq(schema.reportScreenComments.reportType, "working_group"),
						inArray(schema.reportScreenComments.reportId, wgReportIds),
					),
				);
			await this.db
				.delete(schema.workingGroupReportAnswers)
				.where(inArray(schema.workingGroupReportAnswers.workingGroupReportId, wgReportIds));
			await this.db
				.delete(schema.workingGroupReportEvents)
				.where(inArray(schema.workingGroupReportEvents.workingGroupReportId, wgReportIds));
			await this.db
				.delete(schema.workingGroupReportSocialMedia)
				.where(inArray(schema.workingGroupReportSocialMedia.workingGroupReportId, wgReportIds));
			await this.db
				.delete(schema.workingGroupReportChairs)
				.where(inArray(schema.workingGroupReportChairs.workingGroupReportId, wgReportIds));
			await this.db
				.delete(schema.reportExternalResourceSnapshots)
				.where(inArray(schema.reportExternalResourceSnapshots.workingGroupReportId, wgReportIds));
			await this.db
				.delete(schema.workingGroupReports)
				.where(inArray(schema.workingGroupReports.id, wgReportIds));
		}

		await this.db
			.delete(schema.workingGroupReportQuestions)
			.where(eq(schema.workingGroupReportQuestions.campaignId, id));

		const countryReportRows = await this.db
			.select({ id: schema.countryReports.id })
			.from(schema.countryReports)
			.where(eq(schema.countryReports.campaignId, id));

		if (countryReportRows.length > 0) {
			const countryReportIds = countryReportRows.map((r) => r.id);
			await this.db
				.delete(schema.reportScreenComments)
				.where(
					and(
						eq(schema.reportScreenComments.reportType, "country"),
						inArray(schema.reportScreenComments.reportId, countryReportIds),
					),
				);
			await this.db
				.delete(schema.countryReportContributions)
				.where(inArray(schema.countryReportContributions.countryReportId, countryReportIds));
			await this.db
				.delete(schema.countryReportSocialMediaKpis)
				.where(inArray(schema.countryReportSocialMediaKpis.countryReportId, countryReportIds));
			await this.db
				.delete(schema.countryReportSocialMedia)
				.where(inArray(schema.countryReportSocialMedia.countryReportId, countryReportIds));
			await this.db
				.delete(schema.countryReportServiceKpis)
				.where(inArray(schema.countryReportServiceKpis.countryReportId, countryReportIds));
			await this.db
				.delete(schema.countryReportServices)
				.where(inArray(schema.countryReportServices.countryReportId, countryReportIds));
			await this.db
				.delete(schema.countryReportProjectContributions)
				.where(inArray(schema.countryReportProjectContributions.countryReportId, countryReportIds));
			await this.db
				.delete(schema.countryReportInstitutions)
				.where(inArray(schema.countryReportInstitutions.countryReportId, countryReportIds));
			await this.db
				.delete(schema.countryReports)
				.where(inArray(schema.countryReports.id, countryReportIds));
		}

		await this.db
			.delete(schema.reportingCampaignEventAmounts)
			.where(eq(schema.reportingCampaignEventAmounts.campaignId, id));
		await this.db
			.delete(schema.reportingCampaignContributionAmounts)
			.where(eq(schema.reportingCampaignContributionAmounts.campaignId, id));
		await this.db
			.delete(schema.reportingCampaignServiceSizes)
			.where(eq(schema.reportingCampaignServiceSizes.campaignId, id));
		await this.db
			.delete(schema.reportingCampaignSocialMediaAmounts)
			.where(eq(schema.reportingCampaignSocialMediaAmounts.campaignId, id));
		await this.db
			.delete(schema.reportingCampaignCountryThresholds)
			.where(eq(schema.reportingCampaignCountryThresholds.campaignId, id));
	}

	async deleteReportingCampaign(id: string): Promise<void> {
		await this.cleanupCampaignSubTables(id);
		await this.db.delete(schema.reportingCampaigns).where(eq(schema.reportingCampaigns.id, id));
	}

	async getCampaignEventAmounts(
		campaignId: string,
	): Promise<Array<{ amount: number; eventType: string }>> {
		return this.db
			.select({
				amount: schema.reportingCampaignEventAmounts.amount,
				eventType: schema.reportingCampaignEventAmounts.eventType,
			})
			.from(schema.reportingCampaignEventAmounts)
			.where(eq(schema.reportingCampaignEventAmounts.campaignId, campaignId));
	}

	async getCampaignContributionAmounts(
		campaignId: string,
	): Promise<Array<{ amount: number; roleType: string }>> {
		return this.db
			.select({
				amount: schema.reportingCampaignContributionAmounts.amount,
				roleType: schema.reportingCampaignContributionAmounts.roleType,
			})
			.from(schema.reportingCampaignContributionAmounts)
			.where(eq(schema.reportingCampaignContributionAmounts.campaignId, campaignId));
	}

	async getCampaignServiceSizes(
		campaignId: string,
	): Promise<
		Array<{ amount: number | null; serviceSize: string; visitsThreshold: number | null }>
	> {
		return this.db
			.select({
				amount: schema.reportingCampaignServiceSizes.amount,
				serviceSize: schema.reportingCampaignServiceSizes.serviceSize,
				visitsThreshold: schema.reportingCampaignServiceSizes.visitsThreshold,
			})
			.from(schema.reportingCampaignServiceSizes)
			.where(eq(schema.reportingCampaignServiceSizes.campaignId, campaignId));
	}

	async getCampaignSocialMediaAmounts(
		campaignId: string,
	): Promise<Array<{ amount: number; category: string }>> {
		return this.db
			.select({
				amount: schema.reportingCampaignSocialMediaAmounts.amount,
				category: schema.reportingCampaignSocialMediaAmounts.category,
			})
			.from(schema.reportingCampaignSocialMediaAmounts)
			.where(eq(schema.reportingCampaignSocialMediaAmounts.campaignId, campaignId));
	}

	async getCountryReportByCampaignAndCountry(
		campaignId: string,
		countryId: string,
	): Promise<{ id: string; status: string } | null> {
		const [row] = await this.db
			.select({ id: schema.countryReports.id, status: schema.countryReports.status })
			.from(schema.countryReports)
			.where(
				and(
					eq(schema.countryReports.campaignId, campaignId),
					// reports are keyed by country document id.
					eq(schema.countryReports.countryDocumentId, countryId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async getCountryReportById(
		id: string,
	): Promise<{ campaignId: string; countryId: string; id: string; status: string } | null> {
		const [row] = await this.db
			.select({
				campaignId: schema.countryReports.campaignId,
				countryId: schema.countryReports.countryDocumentId,
				id: schema.countryReports.id,
				status: schema.countryReports.status,
			})
			.from(schema.countryReports)
			.where(eq(schema.countryReports.id, id))
			.limit(1);

		return row ?? null;
	}

	async createCountryReport(params: {
		campaignId: string;
		countryDocumentId: string;
		status?: "accepted" | "draft" | "submitted";
	}): Promise<{ id: string }> {
		const { campaignId, countryDocumentId, status = "draft" } = params;
		const [row] = await this.db
			.insert(schema.countryReports)
			.values({ campaignId, countryDocumentId, status })
			.returning({ id: schema.countryReports.id });

		if (row == null) {
			throw new Error("Failed to create country report.");
		}

		return row;
	}

	async getCountryReportServiceIds(countryReportId: string): Promise<Array<string>> {
		const rows = await this.db.query.countryReportServices.findMany({
			where: { countryReportId },
			columns: { serviceId: true },
		});

		return rows.map((row) => row.serviceId);
	}

	async createCountryReportProjectContribution(params: {
		amountEuros: number;
		countryReportId: string;
		projectDocumentId: string;
	}): Promise<{ id: string }> {
		const [row] = await this.db
			.insert(schema.countryReportProjectContributions)
			.values(params)
			.returning({ id: schema.countryReportProjectContributions.id });

		if (row == null) {
			throw new Error("Failed to create country report project contribution.");
		}

		return row;
	}

	async getCountryReportProjectContributionByProjectDocumentId(projectDocumentId: string): Promise<{
		amountEuros: number;
		countryReportId: string;
		id: string;
		projectDocumentId: string;
	} | null> {
		const [row] = await this.db
			.select({
				amountEuros: schema.countryReportProjectContributions.amountEuros,
				countryReportId: schema.countryReportProjectContributions.countryReportId,
				id: schema.countryReportProjectContributions.id,
				projectDocumentId: schema.countryReportProjectContributions.projectDocumentId,
			})
			.from(schema.countryReportProjectContributions)
			.where(eq(schema.countryReportProjectContributions.projectDocumentId, projectDocumentId))
			.limit(1);

		return row ?? null;
	}

	async deleteCountryReport(id: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			await tx
				.delete(schema.reportScreenComments)
				.where(
					and(
						eq(schema.reportScreenComments.reportType, "country"),
						eq(schema.reportScreenComments.reportId, id),
					),
				);
			await tx
				.delete(schema.countryReportContributions)
				.where(eq(schema.countryReportContributions.countryReportId, id));
			await tx
				.delete(schema.countryReportSocialMediaKpis)
				.where(eq(schema.countryReportSocialMediaKpis.countryReportId, id));
			await tx
				.delete(schema.countryReportSocialMedia)
				.where(eq(schema.countryReportSocialMedia.countryReportId, id));
			await tx
				.delete(schema.countryReportServiceKpis)
				.where(eq(schema.countryReportServiceKpis.countryReportId, id));
			await tx
				.delete(schema.countryReportServices)
				.where(eq(schema.countryReportServices.countryReportId, id));
			await tx
				.delete(schema.countryReportProjectContributions)
				.where(eq(schema.countryReportProjectContributions.countryReportId, id));
			await tx
				.delete(schema.countryReportInstitutions)
				.where(eq(schema.countryReportInstitutions.countryReportId, id));
			await tx.delete(schema.countryReports).where(eq(schema.countryReports.id, id));
		});
	}

	async getWorkingGroupReportByCampaignAndGroup(
		campaignId: string,
		workingGroupId: string,
	): Promise<{ id: string; status: string } | null> {
		const [row] = await this.db
			.select({ id: schema.workingGroupReports.id, status: schema.workingGroupReports.status })
			.from(schema.workingGroupReports)
			.where(
				and(
					eq(schema.workingGroupReports.campaignId, campaignId),
					// reports are keyed by working group document id.
					eq(schema.workingGroupReports.workingGroupDocumentId, workingGroupId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async getWorkingGroupReportById(id: string): Promise<{
		campaignId: string;
		id: string;
		status: string;
		workingGroupId: string;
	} | null> {
		const [row] = await this.db
			.select({
				campaignId: schema.workingGroupReports.campaignId,
				id: schema.workingGroupReports.id,
				status: schema.workingGroupReports.status,
				workingGroupId: schema.workingGroupReports.workingGroupDocumentId,
			})
			.from(schema.workingGroupReports)
			.where(eq(schema.workingGroupReports.id, id))
			.limit(1);

		return row ?? null;
	}

	async createWorkingGroupReport(params: {
		campaignId: string;
		workingGroupDocumentId: string;
		status?: "accepted" | "draft" | "submitted";
	}): Promise<{ id: string }> {
		const { campaignId, workingGroupDocumentId, status = "draft" } = params;
		const [row] = await this.db
			.insert(schema.workingGroupReports)
			.values({ campaignId, workingGroupDocumentId, status })
			.returning({ id: schema.workingGroupReports.id });

		if (row == null) {
			throw new Error("Failed to create working group report.");
		}

		return row;
	}

	async deleteWorkingGroupReport(id: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			await tx
				.delete(schema.reportScreenComments)
				.where(
					and(
						eq(schema.reportScreenComments.reportType, "working_group"),
						eq(schema.reportScreenComments.reportId, id),
					),
				);
			await tx
				.delete(schema.workingGroupReportAnswers)
				.where(eq(schema.workingGroupReportAnswers.workingGroupReportId, id));
			await tx
				.delete(schema.workingGroupReportEvents)
				.where(eq(schema.workingGroupReportEvents.workingGroupReportId, id));
			await tx
				.delete(schema.workingGroupReportSocialMedia)
				.where(eq(schema.workingGroupReportSocialMedia.workingGroupReportId, id));
			await tx
				.delete(schema.workingGroupReportChairs)
				.where(eq(schema.workingGroupReportChairs.workingGroupReportId, id));
			await tx
				.delete(schema.reportExternalResourceSnapshots)
				.where(eq(schema.reportExternalResourceSnapshots.workingGroupReportId, id));
			await tx.delete(schema.workingGroupReports).where(eq(schema.workingGroupReports.id, id));
		});
	}

	/**
	 * Seeds a working-group-report question for a campaign. `question` is a minimal tiptap document
	 * wrapping the given text. Cleaned up with the campaign via `cleanupCampaignSubTables`.
	 */
	async createWorkingGroupReportQuestion(params: {
		campaignId: string;
		questionText: string;
		position: number;
	}): Promise<{ id: string }> {
		const { campaignId, questionText, position } = params;
		const [row] = await this.db
			.insert(schema.workingGroupReportQuestions)
			.values({
				campaignId,
				position,
				question: {
					type: "doc",
					content: [{ type: "paragraph", content: [{ type: "text", text: questionText }] }],
				},
			})
			.returning({ id: schema.workingGroupReportQuestions.id });

		if (row == null) {
			throw new Error("Failed to create working group report question.");
		}

		return row;
	}

	async createWorkingGroupReportEvent(params: {
		workingGroupReportId: string;
		title: string;
		role?: "organiser" | "presenter";
		date?: Date;
	}): Promise<{ id: string }> {
		const { workingGroupReportId, title, role = "organiser", date = new Date() } = params;
		const [row] = await this.db
			.insert(schema.workingGroupReportEvents)
			.values({ workingGroupReportId, title, role, date })
			.returning({ id: schema.workingGroupReportEvents.id });

		if (row == null) {
			throw new Error("Failed to create working group report event.");
		}

		return row;
	}

	async getWorkingGroupReportEventById(id: string): Promise<{ id: string } | null> {
		const [row] = await this.db
			.select({ id: schema.workingGroupReportEvents.id })
			.from(schema.workingGroupReportEvents)
			.where(eq(schema.workingGroupReportEvents.id, id))
			.limit(1);

		return row ?? null;
	}

	async getWorkingGroupReportAnswer(
		workingGroupReportId: string,
		questionId: string,
	): Promise<{ answer: unknown } | null> {
		const [row] = await this.db
			.select({ answer: schema.workingGroupReportAnswers.answer })
			.from(schema.workingGroupReportAnswers)
			.where(
				and(
					eq(schema.workingGroupReportAnswers.workingGroupReportId, workingGroupReportId),
					eq(schema.workingGroupReportAnswers.questionId, questionId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async getUserByName(name: string): Promise<{
		canManageAdmins: boolean;
		email: string;
		id: string;
		name: string;
		organisationalUnitId: string | null;
		personId: string | null;
		role: "admin" | "user";
	} | null> {
		const [row] = await this.db
			.select({
				canManageAdmins: schema.users.canManageAdmins,
				email: schema.users.email,
				id: schema.users.id,
				name: schema.users.name,
				// The actor is stored as a document id.
				organisationalUnitId: schema.users.organisationalUnitDocumentId,
				personId: schema.users.personDocumentId,
				role: schema.users.role,
			})
			.from(schema.users)
			.where(eq(schema.users.name, name))
			.limit(1);

		return row ?? null;
	}

	async getPageItemByTitle(title: string): Promise<{
		documentId: string;
		id: string;
		imageId: string | null;
		publicationDate: Date;
		summary: string;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				id: schema.entityVersions.entityId,
				imageId: schema.pages.imageId,
				publicationDate: schema.pages.publicationDate,
				summary: schema.pages.summary,
			})
			.from(schema.pages)
			.innerJoin(schema.entityVersions, eq(schema.pages.id, schema.entityVersions.id))
			.where(eq(schema.pages.title, title))
			.limit(1);

		return row ?? null;
	}

	async getDocumentationPageByTitle(
		title: string,
	): Promise<{ documentId: string; id: string } | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				id: schema.documentationPages.id,
			})
			.from(schema.documentationPages)
			.innerJoin(schema.entityVersions, eq(schema.documentationPages.id, schema.entityVersions.id))
			.where(eq(schema.documentationPages.title, title))
			.limit(1);

		return row ?? null;
	}

	async getDocumentationPageContentBlocksByTitle(
		title: string,
	): Promise<Array<{ type: string; position: number; content: unknown }>> {
		const documentationPage = await this.getDocumentationPageByTitle(title);

		if (documentationPage == null) {
			return [];
		}

		const rows = await this.db
			.select({
				content: sql<unknown>`${schema.richTextContentBlocks.content}`,
				position: schema.contentBlocks.position,
				type: schema.contentBlockTypes.type,
			})
			.from(schema.contentBlocks)
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.contentBlockTypes,
				eq(schema.contentBlocks.typeId, schema.contentBlockTypes.id),
			)
			.leftJoin(
				schema.richTextContentBlocks,
				eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
			)
			.where(eq(schema.fields.entityVersionId, documentationPage.id))
			.orderBy(schema.contentBlocks.position);

		return rows;
	}

	async getEventByTitle(title: string): Promise<{
		documentId: string;
		duration: { start: Date; end?: Date };
		id: string;
		imageId: string;
		isFullDay: boolean | null;
		location: string | null;
		summary: string;
		website: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				duration: schema.events.duration,
				id: schema.events.id,
				imageId: schema.events.imageId,
				isFullDay: schema.events.isFullDay,
				location: schema.events.location,
				summary: schema.events.summary,
				website: schema.events.website,
			})
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.where(eq(schema.events.title, title))
			.limit(1);

		return row ?? null;
	}

	async getEventContentBlocksByTitle(
		title: string,
	): Promise<Array<{ type: string; position: number; content: unknown }>> {
		const [event] = await this.db
			.select({ id: schema.events.id })
			.from(schema.events)
			.where(eq(schema.events.title, title))
			.limit(1);

		return event != null ? this.getContentBlocksByVersionId(event.id) : [];
	}

	async getImpactCaseStudyByTitle(title: string): Promise<{
		documentId: string;
		id: string;
		imageId: string;
		publicationDate: Date;
		summary: string;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				id: schema.impactCaseStudies.id,
				imageId: schema.impactCaseStudies.imageId,
				publicationDate: schema.impactCaseStudies.publicationDate,
				summary: schema.impactCaseStudies.summary,
			})
			.from(schema.impactCaseStudies)
			.innerJoin(schema.entityVersions, eq(schema.impactCaseStudies.id, schema.entityVersions.id))
			.where(eq(schema.impactCaseStudies.title, title))
			.limit(1);

		return row ?? null;
	}

	async getImpactCaseStudyContentBlocksByTitle(
		title: string,
	): Promise<Array<{ type: string; position: number; content: unknown }>> {
		const [item] = await this.db
			.select({ id: schema.impactCaseStudies.id })
			.from(schema.impactCaseStudies)
			.where(eq(schema.impactCaseStudies.title, title))
			.limit(1);

		return item != null ? this.getContentBlocksByVersionId(item.id) : [];
	}

	async getSpotlightArticleByTitle(title: string): Promise<{
		documentId: string;
		id: string;
		imageId: string;
		publicationDate: Date;
		summary: string;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				id: schema.spotlightArticles.id,
				imageId: schema.spotlightArticles.imageId,
				publicationDate: schema.spotlightArticles.publicationDate,
				summary: schema.spotlightArticles.summary,
			})
			.from(schema.spotlightArticles)
			.innerJoin(schema.entityVersions, eq(schema.spotlightArticles.id, schema.entityVersions.id))
			.where(eq(schema.spotlightArticles.title, title))
			.limit(1);

		return row ?? null;
	}

	async getSpotlightArticleContentBlocksByTitle(
		title: string,
	): Promise<Array<{ type: string; position: number; content: unknown }>> {
		const [item] = await this.db
			.select({ id: schema.spotlightArticles.id })
			.from(schema.spotlightArticles)
			.where(eq(schema.spotlightArticles.title, title))
			.limit(1);

		return item != null ? this.getContentBlocksByVersionId(item.id) : [];
	}

	/** Returns the document slug for the spotlight article identified by its exact title. */
	async getSpotlightArticleSlugByTitle(title: string): Promise<string | null> {
		const [row] = await this.db
			.select({ slug: schema.slugs.value })
			.from(schema.spotlightArticles)
			.innerJoin(schema.entityVersions, eq(schema.spotlightArticles.id, schema.entityVersions.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.spotlightArticles.title, title))
			.limit(1);

		return row?.slug ?? null;
	}

	/**
	 * Inserts a published news document that deliberately shares its slug value with another entity
	 * type. Slugs are unique only per `(type, locale, value)` among published rows, so this is valid
	 * data — it reproduces the cross-type collision behind the spotlight details 404. The news title
	 * is worker-prefixed so the standard `cleanupWorkerNewsItems` helper removes it.
	 */
	async createCollidingPublishedNewsDocument(params: {
		slug: string;
		title: string;
		imageId: string;
	}): Promise<{ documentId: string; versionId: string }> {
		const { slug, title, imageId } = params;

		return this.db.transaction(async (tx) => {
			const type = await tx.query.entityTypes.findFirst({
				where: { type: "news" },
				columns: { id: true },
			});
			if (type == null) {
				throw new Error('Entity type "news" not found.');
			}

			const status = await tx.query.entityStatus.findFirst({
				where: { type: "published" },
				columns: { id: true },
			});
			if (status == null) {
				throw new Error('Entity status "published" not found.');
			}

			const locale = await tx.query.locales.findFirst({
				where: { isDefault: true },
				columns: { id: true },
			});
			if (locale == null) {
				throw new Error("Default locale not found in database.");
			}

			const [document] = await tx
				.insert(schema.entities)
				.values({ typeId: type.id })
				.returning({ id: schema.entities.id });
			if (document == null) {
				throw new Error("Failed to insert colliding entity document.");
			}

			const [version] = await tx
				.insert(schema.entityVersions)
				.values({ entityId: document.id, statusId: status.id, localeId: locale.id })
				.returning({ id: schema.entityVersions.id });
			if (version == null) {
				throw new Error("Failed to insert colliding entity version.");
			}

			await tx.insert(schema.news).values({
				id: version.id,
				title,
				summary: "Colliding slug news item",
				imageId,
				publicationDate: new Date("2024-01-15T00:00:00.000Z"),
			});

			await tx.insert(schema.slugs).values({
				entityVersionId: version.id,
				entityId: document.id,
				typeId: type.id,
				localeId: locale.id,
				isPublished: true,
				value: slug,
			});

			return { documentId: document.id, versionId: version.id };
		});
	}

	/**
	 * A never-published news document (draft version only). Its `entities.label` stays null, so it is
	 * invisible to the relation-options pickers — used to prove the maintenance slug editor resolves
	 * drafts through its own options endpoint.
	 */
	async createDraftNewsDocument(params: {
		slug: string;
		title: string;
		imageId: string;
	}): Promise<{ documentId: string; versionId: string }> {
		const { slug, title, imageId } = params;

		return this.db.transaction(async (tx) => {
			const type = await tx.query.entityTypes.findFirst({
				where: { type: "news" },
				columns: { id: true },
			});
			if (type == null) {
				throw new Error('Entity type "news" not found.');
			}

			const status = await tx.query.entityStatus.findFirst({
				where: { type: "draft" },
				columns: { id: true },
			});
			if (status == null) {
				throw new Error('Entity status "draft" not found.');
			}

			const locale = await tx.query.locales.findFirst({
				where: { isDefault: true },
				columns: { id: true },
			});
			if (locale == null) {
				throw new Error("Default locale not found in database.");
			}

			const [document] = await tx
				.insert(schema.entities)
				.values({ typeId: type.id })
				.returning({ id: schema.entities.id });
			if (document == null) {
				throw new Error("Failed to insert draft entity document.");
			}

			const [version] = await tx
				.insert(schema.entityVersions)
				.values({ entityId: document.id, statusId: status.id, localeId: locale.id })
				.returning({ id: schema.entityVersions.id });
			if (version == null) {
				throw new Error("Failed to insert draft entity version.");
			}

			await tx.insert(schema.news).values({
				id: version.id,
				title,
				summary: "Draft-only news item",
				publicationDate: new Date("2024-01-15T00:00:00.000Z"),
				imageId,
			});

			await tx.insert(schema.slugs).values({
				entityVersionId: version.id,
				entityId: document.id,
				typeId: type.id,
				localeId: locale.id,
				isPublished: false,
				value: slug,
			});

			return { documentId: document.id, versionId: version.id };
		});
	}

	/** Insert a document-level entity→entity relation (used to seed the maintenance merge tool). */
	async addEntityToEntityRelation(entityId: string, relatedEntityId: string): Promise<void> {
		await this.db
			.insert(schema.entitiesToEntities)
			.values({ entityId, relatedEntityId, position: 0 })
			.onConflictDoNothing();
	}

	/** Read the current slug of an entity document (used by the maintenance slug editor test). */
	async getEntitySlugByDocumentId(documentId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ slug: schema.slugs.value })
			.from(schema.slugs)
			.where(eq(schema.slugs.entityId, documentId))
			.limit(1);

		return row?.slug ?? null;
	}

	/**
	 * Look up a document by slug together with its lifecycle state — used by the maintenance
	 * duplicate tool test, where the clone is addressable only by its generated `-copy` slug and must
	 * come out draft-only.
	 */
	async getEntityDocumentBySlug(
		slug: string,
	): Promise<{ documentId: string; hasDraft: boolean; hasPublished: boolean } | null> {
		const [row] = await this.db
			.select({
				documentId: schema.slugs.entityId,
				draftId: schema.documentLifecycle.draftId,
				publishedId: schema.documentLifecycle.publishedId,
			})
			.from(schema.slugs)
			.leftJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.slugs.entityId),
			)
			.where(eq(schema.slugs.value, slug))
			.limit(1);

		if (row == null) {
			return null;
		}

		return {
			documentId: row.documentId,
			hasDraft: row.draftId != null,
			hasPublished: row.publishedId != null,
		};
	}

	/** Whether an entity document still exists (a merged-away source should not). */
	async entityDocumentExists(documentId: string): Promise<boolean> {
		const [row] = await this.db
			.select({ id: schema.entities.id })
			.from(schema.entities)
			.where(eq(schema.entities.id, documentId))
			.limit(1);

		return row != null;
	}

	async getFundingCallByTitle(title: string): Promise<{
		documentId: string;
		duration: { start: Date; end?: Date };
		id: string;
		imageId: string;
		summary: string;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				duration: schema.fundingCalls.duration,
				id: schema.fundingCalls.id,
				imageId: schema.fundingCalls.imageId,
				summary: schema.fundingCalls.summary,
			})
			.from(schema.fundingCalls)
			.innerJoin(schema.entityVersions, eq(schema.fundingCalls.id, schema.entityVersions.id))
			.where(eq(schema.fundingCalls.title, title))
			.limit(1);

		return row ?? null;
	}

	async getFundingCallContentBlocksByTitle(
		title: string,
	): Promise<Array<{ type: string; position: number; content: unknown }>> {
		const item = await this.getFundingCallByTitle(title);

		return item != null ? this.getContentBlocksByVersionId(item.id) : [];
	}

	async getOpportunityByTitle(title: string): Promise<{
		documentId: string;
		duration: { start: Date; end?: Date };
		id: string;
		imageId: string;
		sourceId: string;
		summary: string;
		website: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.entityVersions.entityId,
				duration: schema.opportunities.duration,
				id: schema.opportunities.id,
				imageId: schema.opportunities.imageId,
				sourceId: schema.opportunities.sourceId,
				summary: schema.opportunities.summary,
				website: schema.opportunities.website,
			})
			.from(schema.opportunities)
			.innerJoin(schema.entityVersions, eq(schema.opportunities.id, schema.entityVersions.id))
			.where(eq(schema.opportunities.title, title))
			.limit(1);

		return row ?? null;
	}

	async getOpportunityContentBlocksByTitle(
		title: string,
	): Promise<Array<{ type: string; position: number; content: unknown }>> {
		const item = await this.getOpportunityByTitle(title);

		return item != null ? this.getContentBlocksByVersionId(item.id) : [];
	}

	private async getOrganisationalUnitDescriptionByVersionId(versionId: string): Promise<unknown> {
		const [row] = await this.db
			.select({ content: sql<unknown>`${schema.richTextContentBlocks.content}` })
			.from(schema.richTextContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.richTextContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(
				and(
					eq(schema.fields.entityVersionId, versionId),
					eq(schema.entityTypesFieldsNames.fieldName, "description"),
				),
			)
			.limit(1);

		return row?.content ?? null;
	}

	private async getContentBlocksByVersionId(
		versionId: string,
	): Promise<Array<{ type: string; position: number; content: unknown }>> {
		return this.db
			.select({
				content: sql<unknown>`${schema.richTextContentBlocks.content}`,
				position: schema.contentBlocks.position,
				type: schema.contentBlockTypes.type,
			})
			.from(schema.contentBlocks)
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.contentBlockTypes,
				eq(schema.contentBlocks.typeId, schema.contentBlockTypes.id),
			)
			.leftJoin(
				schema.richTextContentBlocks,
				eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
			)
			.where(eq(schema.fields.entityVersionId, versionId))
			.orderBy(schema.contentBlocks.position);
	}

	/** Returns any project scope from the database (needed as a required field). */
	async getProjectScope(): Promise<{ id: string; scope: string }> {
		const [scope] = await this.db
			.select({ id: schema.projectScopes.id, scope: schema.projectScopes.scope })
			.from(schema.projectScopes)
			.limit(1);

		if (scope == null) {
			throw new Error("No project scopes found in the database.");
		}

		return scope;
	}

	async getProjectCall(): Promise<{ id: string; call: string }> {
		const [call] = await this.db
			.select({ id: schema.projectCalls.id, call: schema.projectCalls.call })
			.from(schema.projectCalls)
			.limit(1);

		if (call == null) {
			throw new Error("No project calls found in the database.");
		}

		return call;
	}

	async getProjectCallByValue(
		call: schema.ProjectCall["call"],
	): Promise<{ id: string; call: string } | null> {
		const [row] = await this.db
			.select({ id: schema.projectCalls.id, call: schema.projectCalls.call })
			.from(schema.projectCalls)
			.where(eq(schema.projectCalls.call, call))
			.limit(1);

		return row ?? null;
	}

	private async deleteDocumentVersionTail(
		tx: Transaction,
		versionId: string,
		documentId: string,
	): Promise<void> {
		const entityFields = await tx
			.select({ id: schema.fields.id })
			.from(schema.fields)
			.where(eq(schema.fields.entityVersionId, versionId));

		if (entityFields.length > 0) {
			const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);

			await tx.delete(schema.contentBlocks).where(inArray(schema.contentBlocks.fieldId, fieldIds));
			await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
		}

		// Document-level article contributors may reference this document as the article or the person.
		await tx
			.delete(schema.impactCaseStudiesToPersons)
			.where(
				or(
					eq(schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId, documentId),
					eq(schema.impactCaseStudiesToPersons.personDocumentId, documentId),
				),
			);

		await tx
			.delete(schema.spotlightArticlesToPersons)
			.where(
				or(
					eq(schema.spotlightArticlesToPersons.spotlightArticleDocumentId, documentId),
					eq(schema.spotlightArticlesToPersons.personDocumentId, documentId),
				),
			);

		// Document-level service↔unit relations reference this document on their unit endpoint.
		await tx
			.delete(schema.servicesToOrganisationalUnits)
			.where(eq(schema.servicesToOrganisationalUnits.organisationalUnitDocumentId, documentId));

		// Country-report institution snapshots reference this document with no ON DELETE CASCADE.
		await tx
			.delete(schema.countryReportInstitutions)
			.where(eq(schema.countryReportInstitutions.organisationalUnitDocumentId, documentId));

		await tx
			.delete(schema.entitiesToResources)
			.where(eq(schema.entitiesToResources.entityId, documentId));

		await tx
			.delete(schema.entitiesToEntities)
			.where(
				or(
					eq(schema.entitiesToEntities.entityId, documentId),
					eq(schema.entitiesToEntities.relatedEntityId, documentId),
				),
			);

		await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, versionId));
		await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, versionId));

		// A published document keeps more than one version (e.g. draft + published), each referencing
		// `entities.id` via a non-cascading FK. Per-version cleanup iterates every matching version, so
		// only drop the document row once its last version is gone — otherwise the `DELETE FROM entities`
		// trips the FK from a still-surviving version.
		const remainingVersions = await tx
			.select({ id: schema.entityVersions.id })
			.from(schema.entityVersions)
			.where(eq(schema.entityVersions.entityId, documentId))
			.limit(1);

		if (remainingVersions.length === 0) {
			// A user's actor points at a person or org-unit document via a non-cascading FK
			// (`users_person_document_id_entities_id_fkey`). A suite that linked a user to this document
			// may still be running in the other worker, and its own afterAll cannot help us here — so
			// unlink first rather than let the FK abort this cleanup and leak every row after it.
			await tx
				.update(schema.users)
				.set({ personDocumentId: null })
				.where(eq(schema.users.personDocumentId, documentId));
			await tx
				.update(schema.users)
				.set({ organisationalUnitDocumentId: null })
				.where(eq(schema.users.organisationalUnitDocumentId, documentId));

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		}
	}

	private async resolveVersion(
		tx: Transaction,
		versionId: string,
	): Promise<{ versionId: string; documentId: string } | null> {
		const [row] = await tx
			.select({ id: schema.entityVersions.id, entityId: schema.entityVersions.entityId })
			.from(schema.entityVersions)
			.where(eq(schema.entityVersions.id, versionId))
			.limit(1);

		if (row == null) {
			return null;
		}
		return { versionId: row.id, documentId: row.entityId };
	}

	/**
	 * Cascade-deletes a project and all its related records. Replicates the logic in
	 * `delete-project.action.ts`.
	 */
	async deleteProject(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx
				.delete(schema.projectsToOrganisationalUnits)
				.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, documentId));

			await tx
				.delete(schema.projectsToPersons)
				.where(eq(schema.projectsToPersons.projectDocumentId, documentId));

			await tx
				.delete(schema.projectsToSocialMedia)
				.where(eq(schema.projectsToSocialMedia.projectId, versionId));

			await tx.delete(schema.projects).where(eq(schema.projects.id, versionId));
			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all projects whose name starts with `[e2e-worker-{workerIndex}]` and deletes them. Called
	 * in afterAll to ensure a clean state.
	 */
	async cleanupWorkerProjects(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const projects = await this.db
			.select({ id: schema.projects.id })
			.from(schema.projects)
			.where(sql`${schema.projects.name} LIKE ${`${prefix}%`}`);

		for (const project of projects) {
			await this.deleteProject(project.id);
		}
	}

	/**
	 * Cascade-deletes a page item and all its related records. Replicates the logic in
	 * `delete-page-item.action.ts`.
	 */
	async deletePageItem(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx.delete(schema.pages).where(eq(schema.pages.id, versionId));
			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all pages whose title starts with `[e2e-worker-{workerIndex}]` and deletes them. Called
	 * in afterAll to ensure a clean state.
	 */
	async cleanupWorkerPageItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const pages = await this.db
			.select({ id: schema.pages.id })
			.from(schema.pages)
			.where(sql`${schema.pages.title} LIKE ${`${prefix}%`}`);

		for (const page of pages) {
			await this.deletePageItem(page.id);
		}
	}

	/**
	 * Cascade-deletes an impact case study and all its related records. Replicates the logic in
	 * `delete-impact-case-study.action.ts`.
	 */
	async deleteImpactCaseStudy(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx
				.delete(schema.impactCaseStudiesToPersons)
				.where(eq(schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId, documentId));

			await tx.delete(schema.impactCaseStudies).where(eq(schema.impactCaseStudies.id, versionId));

			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all impact case studies whose title starts with `[e2e-worker-{workerIndex}]` and deletes
	 * them. Called in afterAll to ensure a clean state.
	 */
	async cleanupWorkerImpactCaseStudies(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.impactCaseStudies.id })
			.from(schema.impactCaseStudies)
			.where(sql`${schema.impactCaseStudies.title} LIKE ${`${prefix}%`}`);

		for (const item of items) {
			await this.deleteImpactCaseStudy(item.id);
		}
	}

	/**
	 * Cascade-deletes a spotlight article and all its related records. Replicates the logic in
	 * `delete-spotlight-article.action.ts`.
	 */
	async deleteSpotlightArticle(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx
				.delete(schema.spotlightArticlesToPersons)
				.where(eq(schema.spotlightArticlesToPersons.spotlightArticleDocumentId, documentId));

			await tx.delete(schema.spotlightArticles).where(eq(schema.spotlightArticles.id, versionId));

			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all spotlight articles whose title starts with `[e2e-worker-{workerIndex}]` and deletes
	 * them. Called in afterAll to ensure a clean state.
	 */
	async cleanupWorkerSpotlightArticles(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.spotlightArticles.id })
			.from(schema.spotlightArticles)
			.where(sql`${schema.spotlightArticles.title} LIKE ${`${prefix}%`}`);

		for (const item of items) {
			await this.deleteSpotlightArticle(item.id);
		}
	}

	/**
	 * Cascade-deletes an event and all its related records. Replicates the logic in
	 * `delete-event.action.ts`.
	 */
	async deleteEvent(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx.delete(schema.events).where(eq(schema.events.id, versionId));
			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all events whose title starts with `[e2e-worker-{workerIndex}]` and deletes them. Called
	 * in afterAll to ensure a clean state.
	 */
	async cleanupWorkerEvents(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.events.id })
			.from(schema.events)
			.where(sql`${schema.events.title} LIKE ${`${prefix}%`}`);

		for (const item of items) {
			await this.deleteEvent(item.id);
		}
	}

	/**
	 * Cascade-deletes a news item and all its related records. Replicates the logic in
	 * `delete-news-item.action.ts`.
	 */
	async deleteNewsItem(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx.delete(schema.news).where(eq(schema.news.id, versionId));
			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all news items whose title starts with `[e2e-worker-{workerIndex}]` and deletes them.
	 * Called in afterAll to ensure a clean state.
	 */
	async cleanupWorkerNewsItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.news)
			.innerJoin(schema.entityVersions, eq(schema.news.id, schema.entityVersions.id))
			.where(sql`${schema.news.title} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((row) => row.documentId))];

		for (const documentId of documentIds) {
			await this.deleteNewsDocument(documentId);
		}
	}

	/**
	 * Inserts a social-media entry. The name is expected to be worker-prefixed so the standard
	 * `cleanupWorkerSocialMedia` helper removes it.
	 */
	async createSocialMedia(params: {
		name: string;
		type: (typeof schema.socialMediaTypesEnum)[number];
		url: string;
	}): Promise<{ id: string }> {
		const { name, type, url } = params;

		const typeRow = await this.db.query.socialMediaTypes.findFirst({
			where: { type },
			columns: { id: true },
		});
		if (typeRow == null) {
			throw new Error(`Social-media type "${type}" not found.`);
		}

		const [row] = await this.db
			.insert(schema.socialMedia)
			.values({ name, typeId: typeRow.id, url })
			.returning({ id: schema.socialMedia.id });
		if (row == null) {
			throw new Error("Failed to insert social-media entry.");
		}

		return row;
	}

	/** Deletes assets uploaded by tests after dependent rows have been removed. */
	async cleanupWorkerAssets(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		await this.db.delete(schema.assets).where(sql`${schema.assets.label} LIKE ${`${prefix}%`}`);
	}

	/**
	 * Cascade-deletes a person and all their related records. Replicates the logic in
	 * `delete-person.action.ts`.
	 */
	async deletePerson(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx
				.delete(schema.personsToOrganisationalUnits)
				.where(eq(schema.personsToOrganisationalUnits.personDocumentId, documentId));

			// Article contributor edges point at the person *document*, so they outlive the version and
			// would block the document delete if the article cleanup has not already cleared them.
			await tx
				.delete(schema.spotlightArticlesToPersons)
				.where(eq(schema.spotlightArticlesToPersons.personDocumentId, documentId));
			await tx
				.delete(schema.impactCaseStudiesToPersons)
				.where(eq(schema.impactCaseStudiesToPersons.personDocumentId, documentId));

			// Project affiliations likewise point at the person document.
			await tx
				.delete(schema.projectsToPersons)
				.where(eq(schema.projectsToPersons.personDocumentId, documentId));

			// Version-scoped and subtype-owned, so it has to go before the persons row it references.
			await tx
				.delete(schema.personSocialMedia)
				.where(eq(schema.personSocialMedia.personId, versionId));

			await tx.delete(schema.persons).where(eq(schema.persons.id, versionId));
			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all persons whose name starts with `[e2e-worker-{workerIndex}]` and deletes them. Called
	 * in afterAll to ensure a clean state.
	 */
	async cleanupWorkerPersons(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.persons.id })
			.from(schema.persons)
			.where(sql`${schema.persons.name} LIKE ${`${prefix}%`}`);

		for (const item of items) {
			await this.deletePerson(item.id);
		}
	}

	/**
	 * Deletes ALL versions (draft + published) of a person document and the document row itself. Use
	 * this instead of `deletePerson` when the document may have more than one version (e.g. after
	 * publish or edit-after-publish flows).
	 */
	async deletePersonDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				await tx
					.delete(schema.personsToOrganisationalUnits)
					.where(eq(schema.personsToOrganisationalUnits.personDocumentId, documentId));
				await tx
					.delete(schema.projectsToPersons)
					.where(eq(schema.projectsToPersons.personDocumentId, documentId));
				await tx
					.delete(schema.personSocialMedia)
					.where(eq(schema.personSocialMedia.personId, version.id));
				await tx.delete(schema.persons).where(eq(schema.persons.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	/**
	 * Finds all person documents whose name starts with `[e2e-worker-{workerIndex}]` (across any
	 * version) and deletes all their versions. Safe for lifecycle tests where items may be in
	 * published, draft+published, or published-only state.
	 */
	async cleanupWorkerPersonsLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.where(sql`${schema.persons.name} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deletePersonDocument(documentId);
		}
	}

	/**
	 * Cascade-deletes a working group and all its related records. Replicates the logic in
	 * `delete-working-group.action.ts`.
	 */
	async deleteWorkingGroup(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx
				.delete(schema.organisationalUnitsToSocialMedia)
				.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, versionId));
			await tx
				.delete(schema.organisationalUnitsRelations)
				.where(
					or(
						eq(schema.organisationalUnitsRelations.unitDocumentId, documentId),
						eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, documentId),
					),
				);

			await tx
				.delete(schema.organisationalUnits)
				.where(eq(schema.organisationalUnits.id, versionId));

			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all working groups whose name starts with `[e2e-worker-{workerIndex}]` and deletes them.
	 * Called in afterAll to ensure a clean state.
	 */
	async cleanupWorkerWorkingGroups(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.organisationalUnits.id })
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					sql`${schema.organisationalUnits.name} LIKE ${`${prefix}%`}`,
					eq(schema.organisationalUnitTypes.type, "working_group"),
				),
			);

		for (const item of items) {
			await this.deleteWorkingGroup(item.id);
		}
	}

	/**
	 * Cascade-deletes an institution and all its related records. Replicates the logic in
	 * `delete-institution.action.ts`.
	 */
	async deleteInstitution(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx
				.delete(schema.organisationalUnitsToSocialMedia)
				.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, versionId));
			await tx
				.delete(schema.personsToOrganisationalUnits)
				.where(eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, documentId));
			await tx
				.delete(schema.organisationalUnitsRelations)
				.where(
					or(
						eq(schema.organisationalUnitsRelations.unitDocumentId, documentId),
						eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, documentId),
					),
				);

			await tx
				.delete(schema.organisationalUnits)
				.where(eq(schema.organisationalUnits.id, versionId));

			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all institutions whose name starts with `[e2e-worker-{workerIndex}]` and deletes them.
	 * Called in afterAll to ensure a clean state.
	 */
	async cleanupWorkerInstitutions(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.organisationalUnits.id })
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					sql`${schema.organisationalUnits.name} LIKE ${`${prefix}%`}`,
					eq(schema.organisationalUnitTypes.type, "institution"),
				),
			);

		for (const item of items) {
			await this.deleteInstitution(item.id);
		}
	}

	/** Cascade-deletes a country and all its related records. */
	async deleteCountry(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx
				.delete(schema.organisationalUnitsToSocialMedia)
				.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, versionId));
			await tx
				.delete(schema.organisationalUnitsRelations)
				.where(
					or(
						eq(schema.organisationalUnitsRelations.unitDocumentId, documentId),
						eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, documentId),
					),
				);

			await tx
				.delete(schema.organisationalUnits)
				.where(eq(schema.organisationalUnits.id, versionId));

			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all countries whose name starts with `[e2e-worker-{workerIndex}]` and deletes them.
	 * Called in afterAll to ensure a clean state.
	 */
	async cleanupWorkerCountries(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.organisationalUnits.id })
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					sql`${schema.organisationalUnits.name} LIKE ${`${prefix}%`}`,
					eq(schema.organisationalUnitTypes.type, "country"),
				),
			);

		for (const item of items) {
			await this.deleteCountry(item.id);
		}
	}

	/** Cascade-deletes a governance body and all its related records. */
	async deleteGovernanceBody(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx
				.delete(schema.organisationalUnitsRelations)
				.where(
					or(
						eq(schema.organisationalUnitsRelations.unitDocumentId, documentId),
						eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, documentId),
					),
				);

			await tx
				.delete(schema.personsToOrganisationalUnits)
				.where(eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, documentId));

			await tx
				.delete(schema.organisationalUnits)
				.where(eq(schema.organisationalUnits.id, versionId));

			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Deletes all versions of a governance body document. Unlike deleteGovernanceBody (which handles
	 * a single version), this handles published entities that have both draft and published
	 * versions.
	 */
	async deleteGovernanceBodyDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				await tx
					.delete(schema.organisationalUnitsRelations)
					.where(
						or(
							eq(schema.organisationalUnitsRelations.unitDocumentId, documentId),
							eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, documentId),
						),
					);
				await tx
					.delete(schema.personsToOrganisationalUnits)
					.where(eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, documentId));
				await tx
					.delete(schema.organisationalUnitsToSocialMedia)
					.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, version.id));

				const fieldRows = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));
				if (fieldRows.length > 0) {
					const fieldIds = fieldRows.map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				await tx
					.delete(schema.organisationalUnits)
					.where(eq(schema.organisationalUnits.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));
			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);
			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	/**
	 * Finds all governance bodies whose name starts with `[e2e-worker-{workerIndex}]` and deletes
	 * them. Called in afterAll to ensure a clean state.
	 */
	async cleanupWorkerGovernanceBodies(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.organisationalUnits.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					sql`${schema.organisationalUnits.name} LIKE ${`${prefix}%`}`,
					eq(schema.organisationalUnitTypes.type, "governance_body"),
				),
			);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deleteGovernanceBodyDocument(documentId);
		}
	}

	/** Cascade-deletes a national consortium and all its related records. */
	async deleteNationalConsortium(versionId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const ids = await this.resolveVersion(tx, versionId);
			if (ids == null) {
				return;
			}
			const { documentId } = ids;

			await tx
				.delete(schema.organisationalUnitsToSocialMedia)
				.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, versionId));
			await tx
				.delete(schema.organisationalUnitsRelations)
				.where(
					or(
						eq(schema.organisationalUnitsRelations.unitDocumentId, documentId),
						eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, documentId),
					),
				);

			await tx
				.delete(schema.organisationalUnits)
				.where(eq(schema.organisationalUnits.id, versionId));

			await this.deleteDocumentVersionTail(tx, versionId, documentId);
		});
	}

	/**
	 * Finds all national consortia whose name starts with `[e2e-worker-{workerIndex}]` and deletes
	 * them. Called in afterAll to ensure a clean state.
	 */
	async cleanupWorkerNationalConsortiа(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.organisationalUnits.id })
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					sql`${schema.organisationalUnits.name} LIKE ${`${prefix}%`}`,
					eq(schema.organisationalUnitTypes.type, "national_consortium"),
				),
			);

		for (const item of items) {
			await this.deleteNationalConsortium(item.id);
		}
	}

	/**
	 * Deletes a user. Sessions, password reset sessions, and email verification requests cascade on
	 * user delete.
	 */
	async deleteUser(userId: string): Promise<void> {
		await this.db.delete(schema.users).where(eq(schema.users.id, userId));
	}

	/**
	 * Clears any impersonation left on the given account's sessions, so a test that fails
	 * mid-impersonation does not hand the next one a non-admin identity. Scoped to a single account:
	 * impersonation lives on the impersonator's session row, and the suites in the other Playwright
	 * worker are signed in as different personas that must not be touched.
	 */
	async clearImpersonationsForUser(email: string): Promise<void> {
		await this.db
			.update(schema.sessions)
			.set({ impersonatedUserId: null, impersonationExpiresAt: null })
			.where(inArray(schema.sessions.userId, await this.getUserIdsByEmail(email)));
	}

	/**
	 * Backdates the given account's live impersonations, so a test can observe the lapse without
	 * waiting out `sessions.impersonation.durationMs`. Scoped like {@link clearImpersonationsForUser}.
	 */
	async expireImpersonationsForUser(email: string): Promise<void> {
		await this.db
			.update(schema.sessions)
			.set({ impersonationExpiresAt: new Date(Date.now() - 1000) })
			.where(inArray(schema.sessions.userId, await this.getUserIdsByEmail(email)));
	}

	private async getUserIdsByEmail(email: string): Promise<Array<string>> {
		const rows = await this.db
			.select({ id: schema.users.id })
			.from(schema.users)
			// The unique index is on `lower(email)`, so match the same way.
			.where(sql`lower(${schema.users.email}) = lower(${email})`);

		if (rows.length === 0) {
			throw new Error(`Expected a seeded e2e user with email "${email}".`);
		}

		return rows.map((row) => row.id);
	}

	/**
	 * Finds all users whose name starts with `[e2e-worker-{workerIndex}]` and deletes them. Called in
	 * afterAll to ensure a clean state.
	 */
	async cleanupWorkerUsers(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.users.id })
			.from(schema.users)
			.where(sql`${schema.users.name} LIKE ${`${prefix}%`}`);

		for (const item of items) {
			await this.deleteUser(item.id);
		}
	}

	async createService(params: {
		name: string;
		sshocMarketplaceId?: string;
		status?: (typeof schema.serviceStatusesEnum)[number];
		type?: (typeof schema.serviceTypesEnum)[number];
	}): Promise<{ id: string }> {
		const { name, sshocMarketplaceId = null, status = "live", type = "internal" } = params;

		const [typeRow, statusRow] = await Promise.all([
			this.db.query.serviceTypes.findFirst({ where: { type }, columns: { id: true } }),
			this.db.query.serviceStatuses.findFirst({ where: { status }, columns: { id: true } }),
		]);
		if (typeRow == null) {
			throw new Error(`Service type "${type}" not found.`);
		}
		if (statusRow == null) {
			throw new Error(`Service status "${status}" not found.`);
		}

		const [row] = await this.db
			.insert(schema.services)
			.values({ name, sshocMarketplaceId, statusId: statusRow.id, typeId: typeRow.id })
			.returning({ id: schema.services.id });
		if (row == null) {
			throw new Error("Failed to insert service.");
		}

		return row;
	}

	async getServiceStatus(
		serviceId: string,
	): Promise<(typeof schema.serviceStatusesEnum)[number] | null> {
		const [row] = await this.db
			.select({ status: schema.serviceStatuses.status })
			.from(schema.services)
			.innerJoin(schema.serviceStatuses, eq(schema.services.statusId, schema.serviceStatuses.id))
			.where(eq(schema.services.id, serviceId))
			.limit(1);

		return row?.status ?? null;
	}

	/**
	 * Cascade-deletes a service and all its related records. Replicates the logic in
	 * `delete-service.action.ts`.
	 */
	async deleteService(serviceId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			await tx
				.delete(schema.countryReportServiceKpis)
				.where(eq(schema.countryReportServiceKpis.serviceId, serviceId));
			await tx
				.delete(schema.countryReportServices)
				.where(eq(schema.countryReportServices.serviceId, serviceId));
			await tx
				.delete(schema.servicesToSocialMedia)
				.where(eq(schema.servicesToSocialMedia.serviceId, serviceId));
			await tx
				.delete(schema.servicesToOrganisationalUnits)
				.where(eq(schema.servicesToOrganisationalUnits.serviceId, serviceId));
			await tx.delete(schema.services).where(eq(schema.services.id, serviceId));
		});
	}

	/**
	 * Finds all services whose name starts with `[e2e-worker-{workerIndex}]` and deletes them. Called
	 * in afterAll to ensure a clean state.
	 */
	async cleanupWorkerServices(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.services.id })
			.from(schema.services)
			.where(sql`${schema.services.name} LIKE ${`${prefix}%`}`);

		for (const item of items) {
			await this.deleteService(item.id);
		}
	}

	/**
	 * Cascade-deletes a social media entry and all its related records. Replicates the logic in
	 * `delete-social-media.action.ts`.
	 */
	async deleteSocialMedia(socialMediaId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			await tx
				.delete(schema.servicesToSocialMedia)
				.where(eq(schema.servicesToSocialMedia.socialMediaId, socialMediaId));
			await tx.delete(schema.socialMedia).where(eq(schema.socialMedia.id, socialMediaId));
		});
	}

	/**
	 * Finds all social media entries whose name starts with `[e2e-worker-{workerIndex}]` and deletes
	 * them. Called in afterAll to ensure a clean state.
	 */
	async cleanupWorkerSocialMedia(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const items = await this.db
			.select({ id: schema.socialMedia.id })
			.from(schema.socialMedia)
			.where(sql`${schema.socialMedia.name} LIKE ${`${prefix}%`}`);

		for (const item of items) {
			await this.deleteSocialMedia(item.id);
		}
	}

	/**
	 * Deletes ALL versions (draft + published) of a news document and the document row itself. Use
	 * this instead of `deleteNewsItem` when the document may have more than one version (e.g. after
	 * publish or edit-after-publish flows).
	 */
	async deleteNewsDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				await tx.delete(schema.news).where(eq(schema.news.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	/**
	 * Finds all news documents whose title starts with `[e2e-worker-{workerIndex}]` (across any
	 * version) and deletes all their versions. Safe for lifecycle tests where items may be in
	 * published, draft+published, or published-only state.
	 */
	async cleanupWorkerNewsLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.news)
			.innerJoin(schema.entityVersions, eq(schema.news.id, schema.entityVersions.id))
			.where(sql`${schema.news.title} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deleteNewsDocument(documentId);
		}
	}

	/** Returns the document asset inserted by globalSetup. */
	async getTestDocumentAsset(): Promise<{ id: string; key: string }> {
		const asset = await this.db.query.assets.findFirst({
			where: { key: "documents/e2e-test-document" },
			columns: { id: true, key: true },
		});

		if (asset == null) {
			throw new Error(
				`Test document asset "documents/e2e-test-document" not found — make sure globalSetup ran successfully.`,
			);
		}

		return asset;
	}

	async getDocumentPolicyGroup(): Promise<{ id: string; label: string }> {
		const [group] = await this.db
			.select({ id: schema.documentPolicyGroups.id, label: schema.documentPolicyGroups.label })
			.from(schema.documentPolicyGroups)
			.orderBy(schema.documentPolicyGroups.position, schema.documentPolicyGroups.label)
			.limit(1);

		if (group == null) {
			throw new Error("Expected at least one document policy group for e2e tests.");
		}

		return group;
	}

	async getDocumentPolicyGroupsByLabelPrefix(
		prefix: string,
	): Promise<Array<{ id: string; label: string; position: number }>> {
		return this.db
			.select({
				id: schema.documentPolicyGroups.id,
				label: schema.documentPolicyGroups.label,
				position: schema.documentPolicyGroups.position,
			})
			.from(schema.documentPolicyGroups)
			.where(sql`${schema.documentPolicyGroups.label} LIKE ${`${prefix}%`}`)
			.orderBy(schema.documentPolicyGroups.position, schema.documentPolicyGroups.label);
	}

	async getDocumentPolicyGroupLabels(): Promise<Array<string>> {
		const groups = await this.db
			.select({ label: schema.documentPolicyGroups.label })
			.from(schema.documentPolicyGroups)
			.orderBy(schema.documentPolicyGroups.position, schema.documentPolicyGroups.label);

		return groups.map((group) => group.label);
	}

	async setDocumentPolicyGroupPositions(labels: Array<string>, position: number): Promise<void> {
		await this.db
			.update(schema.documentPolicyGroups)
			.set({ position })
			.where(inArray(schema.documentPolicyGroups.label, labels));
	}

	async cleanupWorkerDocumentPolicyGroups(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;
		const groups = await this.getDocumentPolicyGroupsByLabelPrefix(prefix);
		const groupIds = groups.map((group) => group.id);

		if (groupIds.length === 0) {
			return;
		}

		await this.db.transaction(async (tx) => {
			await tx
				.update(schema.documentsPolicies)
				.set({ groupId: null })
				.where(inArray(schema.documentsPolicies.groupId, groupIds));
			await tx
				.delete(schema.documentPolicyGroups)
				.where(inArray(schema.documentPolicyGroups.id, groupIds));
		});
	}

	async getDocumentOrPolicyByTitle(title: string): Promise<{
		documentId: string;
		groupId: string | null;
		id: string;
		summary: string | null;
		url: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				documentId: schema.documentsPolicies.documentId,
				groupId: schema.documentsPolicies.groupId,
				id: schema.documentsPolicies.id,
				summary: schema.documentsPolicies.summary,
				url: schema.documentsPolicies.url,
			})
			.from(schema.documentsPolicies)
			.where(eq(schema.documentsPolicies.title, title))
			.limit(1);

		return row ?? null;
	}

	async getDocumentOrPolicyContentBlocksByTitle(
		title: string,
	): Promise<Array<{ type: string; position: number; content: unknown }>> {
		const item = await this.getDocumentOrPolicyByTitle(title);

		return item != null ? this.getContentBlocksByVersionId(item.id) : [];
	}

	/** Returns the first opportunity source from the database. */
	async getOpportunitySource(): Promise<{ id: string; source: string }> {
		const [source] = await this.db
			.select({ id: schema.opportunitySources.id, source: schema.opportunitySources.source })
			.from(schema.opportunitySources)
			.limit(1);

		if (source == null) {
			throw new Error("No opportunity sources found in the database.");
		}

		return source;
	}

	async deleteProjectDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				await tx
					.delete(schema.projectsToOrganisationalUnits)
					.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, documentId));
				await tx
					.delete(schema.projectsToPersons)
					.where(eq(schema.projectsToPersons.projectDocumentId, documentId));
				await tx
					.delete(schema.projectsToSocialMedia)
					.where(eq(schema.projectsToSocialMedia.projectId, version.id));
				await tx.delete(schema.projects).where(eq(schema.projects.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	async cleanupWorkerProjectsLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.projects)
			.innerJoin(schema.entityVersions, eq(schema.projects.id, schema.entityVersions.id))
			.where(sql`${schema.projects.name} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deleteProjectDocument(documentId);
		}
	}

	async deleteEventDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				await tx.delete(schema.events).where(eq(schema.events.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	async cleanupWorkerEventsLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.events)
			.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
			.where(sql`${schema.events.title} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deleteEventDocument(documentId);
		}
	}

	async deleteSpotlightArticleDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				// Contributors are document-level; remove them once by document id.
				await tx
					.delete(schema.spotlightArticlesToPersons)
					.where(eq(schema.spotlightArticlesToPersons.spotlightArticleDocumentId, documentId));
				await tx
					.delete(schema.spotlightArticles)
					.where(eq(schema.spotlightArticles.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	async cleanupWorkerSpotlightArticlesLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.spotlightArticles)
			.innerJoin(schema.entityVersions, eq(schema.spotlightArticles.id, schema.entityVersions.id))
			.where(sql`${schema.spotlightArticles.title} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deleteSpotlightArticleDocument(documentId);
		}
	}

	async deleteImpactCaseStudyDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				// Contributors are document-level; remove them once by document id.
				await tx
					.delete(schema.impactCaseStudiesToPersons)
					.where(eq(schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId, documentId));
				await tx
					.delete(schema.impactCaseStudies)
					.where(eq(schema.impactCaseStudies.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	async cleanupWorkerImpactCaseStudiesLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.impactCaseStudies)
			.innerJoin(schema.entityVersions, eq(schema.impactCaseStudies.id, schema.entityVersions.id))
			.where(sql`${schema.impactCaseStudies.title} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deleteImpactCaseStudyDocument(documentId);
		}
	}

	async deletePageDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				await tx.delete(schema.pages).where(eq(schema.pages.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	async cleanupWorkerPageItemsLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.pages)
			.innerJoin(schema.entityVersions, eq(schema.pages.id, schema.entityVersions.id))
			.where(sql`${schema.pages.title} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deletePageDocument(documentId);
		}
	}

	async deleteDocumentationPageDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				await tx
					.delete(schema.documentationPages)
					.where(eq(schema.documentationPages.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	async cleanupWorkerDocumentationPagesLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.documentationPages)
			.innerJoin(schema.entityVersions, eq(schema.documentationPages.id, schema.entityVersions.id))
			.where(sql`${schema.documentationPages.title} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deleteDocumentationPageDocument(documentId);
		}
	}

	async deleteDocumentOrPolicyDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				await tx
					.delete(schema.documentsPolicies)
					.where(eq(schema.documentsPolicies.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	async cleanupWorkerDocumentsPoliciesLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.documentsPolicies)
			.innerJoin(schema.entityVersions, eq(schema.documentsPolicies.id, schema.entityVersions.id))
			.where(sql`${schema.documentsPolicies.title} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deleteDocumentOrPolicyDocument(documentId);
		}
	}

	async deleteFundingCallDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				await tx.delete(schema.fundingCalls).where(eq(schema.fundingCalls.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	async cleanupWorkerFundingCallsLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.fundingCalls)
			.innerJoin(schema.entityVersions, eq(schema.fundingCalls.id, schema.entityVersions.id))
			.where(sql`${schema.fundingCalls.title} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deleteFundingCallDocument(documentId);
		}
	}

	async deleteOpportunityDocument(documentId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
			const versions = await tx
				.select({ id: schema.entityVersions.id })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, documentId));

			for (const version of versions) {
				const entityFields = await tx
					.select({ id: schema.fields.id })
					.from(schema.fields)
					.where(eq(schema.fields.entityVersionId, version.id));

				if (entityFields.length > 0) {
					const fieldIds = (entityFields as Array<{ id: string }>).map((f) => f.id);
					await tx
						.delete(schema.contentBlocks)
						.where(inArray(schema.contentBlocks.fieldId, fieldIds));
					await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
				}

				await tx.delete(schema.opportunities).where(eq(schema.opportunities.id, version.id));
				await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, version.id));
				await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
			}

			await tx
				.delete(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, documentId));

			await tx
				.delete(schema.entitiesToEntities)
				.where(
					or(
						eq(schema.entitiesToEntities.entityId, documentId),
						eq(schema.entitiesToEntities.relatedEntityId, documentId),
					),
				);

			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
		});
	}

	async cleanupWorkerOpportunitiesLifecycleItems(workerIndex: number): Promise<void> {
		const prefix = `[e2e-worker-${String(workerIndex)}]`;

		const rows = await this.db
			.select({ documentId: schema.entityVersions.entityId })
			.from(schema.opportunities)
			.innerJoin(schema.entityVersions, eq(schema.opportunities.id, schema.entityVersions.id))
			.where(sql`${schema.opportunities.title} LIKE ${`${prefix}%`}`);

		const documentIds = [...new Set(rows.map((r) => r.documentId))];

		for (const documentId of documentIds) {
			await this.deleteOpportunityDocument(documentId);
		}
	}

	/**
	 * Pre-flight cleanup that wipes every leaked `[e2e-worker-N]`-prefixed row, across all worker
	 * indices, by running every per-worker cleanup we have. Intended to be called from `globalSetup`
	 * so that a worker which died abnormally in a previous run can't leave the DB in a state that
	 * fails the leak check in `globalTeardown`.
	 *
	 * Approach: scan every tracked title/name column for the prefix, parse the worker index out of
	 * each match, then fan all the existing per-worker cleanups out across that set.
	 */
	async cleanupAllE2EWorkerLeaks(): Promise<void> {
		const indices = new Set<number>();
		const pattern = /^\[e2e-worker-(\d+)\]/;
		const collect = (identifier: string | null): void => {
			const match = pattern.exec(identifier ?? "");
			if (match?.[1] != null) {
				indices.add(Number(match[1]));
			}
		};

		for (const row of await this.db
			.select({ identifier: schema.persons.name })
			.from(schema.persons)
			.where(sql`${schema.persons.name} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.projects.name })
			.from(schema.projects)
			.where(sql`${schema.projects.name} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.pages.title })
			.from(schema.pages)
			.where(sql`${schema.pages.title} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.impactCaseStudies.title })
			.from(schema.impactCaseStudies)
			.where(sql`${schema.impactCaseStudies.title} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.spotlightArticles.title })
			.from(schema.spotlightArticles)
			.where(sql`${schema.spotlightArticles.title} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.events.title })
			.from(schema.events)
			.where(sql`${schema.events.title} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.news.title })
			.from(schema.news)
			.where(sql`${schema.news.title} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.organisationalUnits.name })
			.from(schema.organisationalUnits)
			.where(sql`${schema.organisationalUnits.name} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.services.name })
			.from(schema.services)
			.where(sql`${schema.services.name} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.socialMedia.name })
			.from(schema.socialMedia)
			.where(sql`${schema.socialMedia.name} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.users.name })
			.from(schema.users)
			.where(sql`${schema.users.name} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}
		for (const row of await this.db
			.select({ identifier: schema.assets.label })
			.from(schema.assets)
			.where(sql`${schema.assets.label} LIKE '[e2e-worker-%'`)) {
			collect(row.identifier);
		}

		for (const workerIndex of indices) {
			// Lifecycle subtypes first — they share the same backing tables as their non-lifecycle
			// counterparts, but their cleanups follow the document-versioning rules.
			await this.cleanupWorkerProjectsLifecycleItems(workerIndex);
			await this.cleanupWorkerEventsLifecycleItems(workerIndex);
			await this.cleanupWorkerNewsLifecycleItems(workerIndex);
			await this.cleanupWorkerSpotlightArticlesLifecycleItems(workerIndex);
			await this.cleanupWorkerImpactCaseStudiesLifecycleItems(workerIndex);
			await this.cleanupWorkerPageItemsLifecycleItems(workerIndex);
			await this.cleanupWorkerDocumentationPagesLifecycleItems(workerIndex);
			await this.cleanupWorkerDocumentsPoliciesLifecycleItems(workerIndex);
			await this.cleanupWorkerFundingCallsLifecycleItems(workerIndex);
			await this.cleanupWorkerOpportunitiesLifecycleItems(workerIndex);
			await this.cleanupWorkerPersonsLifecycleItems(workerIndex);

			// Then the non-lifecycle / simple cleanups.
			await this.cleanupWorkerProjects(workerIndex);
			await this.cleanupWorkerPageItems(workerIndex);
			await this.cleanupWorkerImpactCaseStudies(workerIndex);
			await this.cleanupWorkerSpotlightArticles(workerIndex);
			await this.cleanupWorkerEvents(workerIndex);
			await this.cleanupWorkerNewsItems(workerIndex);
			await this.cleanupWorkerPersons(workerIndex);
			await this.cleanupWorkerWorkingGroups(workerIndex);
			await this.cleanupWorkerInstitutions(workerIndex);
			await this.cleanupWorkerCountries(workerIndex);
			await this.cleanupWorkerGovernanceBodies(workerIndex);
			await this.cleanupWorkerNationalConsortiа(workerIndex);
			await this.cleanupWorkerServices(workerIndex);
			await this.cleanupWorkerSocialMedia(workerIndex);
			await this.cleanupWorkerUsers(workerIndex);
			await this.cleanupWorkerAssets(workerIndex);
		}

		// Reporting campaigns use reserved years as their identifier (no [e2e-worker-N] prefix), so
		// they are not discovered by the name scan above. Delete leftovers in that range directly.
		const leakedCampaigns = await this.db
			.select({ id: schema.reportingCampaigns.id })
			.from(schema.reportingCampaigns)
			.where(
				sql`${schema.reportingCampaigns.year} >= 3100 AND ${schema.reportingCampaigns.year} < 3300`,
			);
		for (const campaign of leakedCampaigns) {
			await this.deleteReportingCampaign(campaign.id);
		}
	}

	/** Closes the underlying pg pool. Called in worker teardown. */
	async close(): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		await (this.db as any).$client?.end?.();
		// `createDatabaseService` caches the pool on `globalThis.__db`. Playwright reuses the same OS
		// process for a worker across projects (this config has 9, each with different `use` options),
		// tearing down and recreating worker-scoped fixtures like `db` at that boundary — but the process,
		// and therefore this cache, persists across the recreation. Without clearing it here, the next
		// `new DatabaseService()` in this same process would get handed back this now-ended pool and fail
		// with "Cannot use a pool after calling end on the pool".
		globalThis.__db = undefined;
	}
}
