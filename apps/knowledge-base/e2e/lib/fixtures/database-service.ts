import { type Transaction, createDatabaseService } from "@acdh-knowledge-base/database";
import * as schema from "@acdh-knowledge-base/database/schema";
import { and, eq, inArray, or, sql } from "@acdh-knowledge-base/database/sql";
import type { InferOk } from "better-result";

import { env } from "../../../config/env.config";

export const E2E_TEST_ASSET_KEY = "images/e2e-test-asset";
export const E2E_TEST_ASSET_LABEL = "E2E Test Asset";

type Database = InferOk<ReturnType<typeof createDatabaseService>>;

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
	 * Returns the first entity from the database, formatted as it appears in the "Related entities"
	 * MultipleSelect. Used as a test relation target.
	 */
	async getTestEntity(): Promise<{ id: string; name: string }> {
		const entity = await this.db.query.entities.findFirst({
			columns: { id: true, slug: true },
			with: { type: { columns: { type: true } } },
			orderBy: { slug: "asc" },
		});

		if (entity == null) {
			throw new Error("No entities found in database — required for relation tests.");
		}

		return { id: entity.id, name: entity.slug };
	}

	async getTestEntities(count: number): Promise<Array<{ id: string; name: string }>> {
		const entities = await this.db.query.entities.findMany({
			columns: { id: true, slug: true },
			orderBy: { slug: "asc" },
			limit: count,
		});

		if (entities.length < count) {
			throw new Error(`Expected at least ${String(count)} entities for relation tests.`);
		}

		return entities.map((entity) => {
			return { id: entity.id, name: entity.slug };
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
				.where(eq(schema.entitiesToEntities.entityId, entityId)),
			this.db
				.select({ resourceId: schema.entitiesToResources.resourceId })
				.from(schema.entitiesToResources)
				.where(eq(schema.entitiesToResources.entityId, entityId)),
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
	async getNewsItemByTitle(
		title: string,
	): Promise<{ id: string; imageId: string; summary: string } | null> {
		const [row] = await this.db
			.select({
				id: schema.entityVersions.entityId,
				imageId: schema.news.imageId,
				summary: schema.news.summary,
			})
			.from(schema.news)
			.innerJoin(schema.entityVersions, eq(schema.news.id, schema.entityVersions.id))
			.where(eq(schema.news.title, title))
			.limit(1);

		return row ?? null;
	}

	async getAssetByLabel(label: string): Promise<{ id: string; key: string } | null> {
		const asset = await this.db.query.assets.findFirst({
			where: { label },
			columns: { id: true, key: true },
		});

		return asset ?? null;
	}

	async getNewsContentBlocksByTitle(
		title: string,
	): Promise<Array<{ type: string; position: number; content: unknown }>> {
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

	async getWorkingGroupByName(name: string): Promise<{
		acronym: string | null;
		documentId: string;
		id: string;
		imageId: string | null;
		name: string;
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
					eq(schema.organisationalUnitTypes.type, "working_group"),
				),
			)
			.limit(1);

		return row ?? null;
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
		}>
	> {
		return this.db
			.select({
				id: schema.personsToOrganisationalUnits.id,
				organisationalUnitId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				roleType: schema.personRoleTypes.type,
				duration: schema.personsToOrganisationalUnits.duration,
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
		}>
	> {
		return this.db
			.select({
				id: schema.organisationalUnitsRelations.id,
				// resolve the related unit document back to its published version id.
				relatedUnitId: schema.organisationalUnits.id,
				statusType: schema.organisationalUnitStatus.status,
				duration: schema.organisationalUnitsRelations.duration,
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
				documentId: schema.entities.id,
				id: schema.internalPages.id,
				slug: schema.entities.slug,
				title: schema.internalPages.title,
			})
			.from(schema.internalPages)
			.innerJoin(schema.entityVersions, eq(schema.internalPages.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
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
		call: string | null;
		documentId: string;
		duration: { start: Date; end?: Date } | null;
		funding: number | null;
		id: string;
		imageId: string | null;
		name: string;
		scopeId: string;
		summary: string;
		topic: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				acronym: schema.projects.acronym,
				call: schema.projects.call,
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

		const socialMedia = await this.db
			.select({ socialMediaId: schema.projectsToSocialMedia.socialMediaId })
			.from(schema.projectsToSocialMedia)
			.where(eq(schema.projectsToSocialMedia.projectId, project.id));

		return {
			partners,
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
			.where(eq(schema.entityStatus.type, "published"))
			.orderBy(schema.organisationalUnits.name)
			.limit(limit);
	}

	async getPersonOption(): Promise<{ id: string; name: string }> {
		const [row] = await this.db
			.select({ id: schema.persons.id, name: schema.persons.name })
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(eq(schema.entityStatus.type, "published"))
			.orderBy(schema.persons.name)
			.limit(1);

		if (row == null) {
			throw new Error("Expected at least one person for e2e tests.");
		}

		return row;
	}

	async getCountryOption(): Promise<{ id: string; name: string }> {
		const [row] = await this.db
			// reports key the country by document id.
			.select({ id: schema.entityVersions.entityId, name: schema.organisationalUnits.name })
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(
				and(
					eq(schema.organisationalUnitTypes.type, "country"),
					eq(schema.entityStatus.type, "published"),
				),
			)
			.orderBy(schema.organisationalUnits.name)
			.limit(1);

		if (row == null) {
			throw new Error("Expected at least one country for e2e tests.");
		}

		return row;
	}

	async getWorkingGroupOption(): Promise<{ id: string; name: string }> {
		const [row] = await this.db
			// reports key the working group by document id.
			.select({ id: schema.entityVersions.entityId, name: schema.organisationalUnits.name })
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(
				and(
					eq(schema.organisationalUnitTypes.type, "working_group"),
					eq(schema.entityStatus.type, "published"),
				),
			)
			.orderBy(schema.organisationalUnits.name)
			.limit(1);

		if (row == null) {
			throw new Error("Expected at least one working group for e2e tests.");
		}

		return row;
	}

	async createOpenCampaign(year: number): Promise<{ id: string }> {
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
				.delete(schema.workingGroupReportAnswers)
				.where(inArray(schema.workingGroupReportAnswers.workingGroupReportId, wgReportIds));
			await this.db
				.delete(schema.workingGroupReportEvents)
				.where(inArray(schema.workingGroupReportEvents.workingGroupReportId, wgReportIds));
			await this.db
				.delete(schema.workingGroupReportSocialMedia)
				.where(inArray(schema.workingGroupReportSocialMedia.workingGroupReportId, wgReportIds));
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
				.delete(schema.countryReportContributions)
				.where(inArray(schema.countryReportContributions.countryReportId, countryReportIds));
			await this.db
				.delete(schema.countryReportSocialMediaKpis)
				.where(inArray(schema.countryReportSocialMediaKpis.countryReportId, countryReportIds));
			await this.db
				.delete(schema.countryReportServiceKpis)
				.where(inArray(schema.countryReportServiceKpis.countryReportId, countryReportIds));
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
		await this.db.delete(schema.countryReports).where(eq(schema.countryReports.id, id));
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

	async deleteWorkingGroupReport(id: string): Promise<void> {
		await this.db.delete(schema.workingGroupReports).where(eq(schema.workingGroupReports.id, id));
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

	async getPageItemByTitle(
		title: string,
	): Promise<{ id: string; imageId: string | null; summary: string } | null> {
		const [row] = await this.db
			.select({
				id: schema.entityVersions.entityId,
				imageId: schema.pages.imageId,
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
				duration: schema.events.duration,
				id: schema.events.id,
				imageId: schema.events.imageId,
				isFullDay: schema.events.isFullDay,
				location: schema.events.location,
				summary: schema.events.summary,
				website: schema.events.website,
			})
			.from(schema.events)
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
		id: string;
		imageId: string;
		summary: string;
	} | null> {
		const [row] = await this.db
			.select({
				id: schema.impactCaseStudies.id,
				imageId: schema.impactCaseStudies.imageId,
				summary: schema.impactCaseStudies.summary,
			})
			.from(schema.impactCaseStudies)
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
		id: string;
		imageId: string;
		summary: string;
	} | null> {
		const [row] = await this.db
			.select({
				id: schema.spotlightArticles.id,
				imageId: schema.spotlightArticles.imageId,
				summary: schema.spotlightArticles.summary,
			})
			.from(schema.spotlightArticles)
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
			.select({ slug: schema.entities.slug })
			.from(schema.spotlightArticles)
			.innerJoin(schema.entityVersions, eq(schema.spotlightArticles.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.where(eq(schema.spotlightArticles.title, title))
			.limit(1);

		return row?.slug ?? null;
	}

	/**
	 * Inserts a published news document that deliberately shares `slug` with another entity type.
	 * Slugs are unique only per `(type, slug)`, so this is valid data — it reproduces the cross-type
	 * collision behind the spotlight details 404. The news title is worker-prefixed so the standard
	 * `cleanupWorkerNewsItems` helper removes it.
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

			const [document] = await tx
				.insert(schema.entities)
				.values({ slug, typeId: type.id })
				.returning({ id: schema.entities.id });
			if (document == null) {
				throw new Error("Failed to insert colliding entity document.");
			}

			const [version] = await tx
				.insert(schema.entityVersions)
				.values({ entityId: document.id, statusId: status.id })
				.returning({ id: schema.entityVersions.id });
			if (version == null) {
				throw new Error("Failed to insert colliding entity version.");
			}

			await tx.insert(schema.news).values({
				id: version.id,
				title,
				summary: "Colliding slug news item",
				imageId,
			});

			return { documentId: document.id, versionId: version.id };
		});
	}

	async getFundingCallByTitle(title: string): Promise<{
		duration: { start: Date; end?: Date };
		id: string;
		summary: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				duration: schema.fundingCalls.duration,
				id: schema.fundingCalls.id,
				summary: schema.fundingCalls.summary,
			})
			.from(schema.fundingCalls)
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
		duration: { start: Date; end?: Date };
		id: string;
		sourceId: string;
		summary: string | null;
		website: string | null;
	} | null> {
		const [row] = await this.db
			.select({
				duration: schema.opportunities.duration,
				id: schema.opportunities.id,
				sourceId: schema.opportunities.sourceId,
				summary: schema.opportunities.summary,
				website: schema.opportunities.website,
			})
			.from(schema.opportunities)
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
				await tx.delete(schema.persons).where(eq(schema.persons.id, version.id));
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

	/**
	 * Cascade-deletes a service and all its related records. Replicates the logic in
	 * `delete-service.action.ts`.
	 */
	async deleteService(serviceId: string): Promise<void> {
		await this.db.transaction(async (tx) => {
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
					.delete(schema.projectsToSocialMedia)
					.where(eq(schema.projectsToSocialMedia.projectId, version.id));
				await tx.delete(schema.projects).where(eq(schema.projects.id, version.id));
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

		// Reporting campaigns use year 3100+workerIndex as their identifier (no [e2e-worker-N] prefix),
		// so they are not discovered by the name scan above. Delete any leftover campaigns in the
		// reserved year range directly.
		const leakedCampaigns = await this.db
			.select({ id: schema.reportingCampaigns.id })
			.from(schema.reportingCampaigns)
			.where(
				sql`${schema.reportingCampaigns.year} >= 3100 AND ${schema.reportingCampaigns.year} < 3200`,
			);
		for (const campaign of leakedCampaigns) {
			await this.deleteReportingCampaign(campaign.id);
		}
	}

	/** Closes the underlying pg pool. Called in worker teardown. */
	async close(): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		await (this.db as any).$client?.end?.();
	}
}
