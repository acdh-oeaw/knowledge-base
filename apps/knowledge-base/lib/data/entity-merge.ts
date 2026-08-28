import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import slugify from "@sindresorhus/slugify";

import { deleteDocumentRelations, getDocumentVersions } from "@/lib/data/entity-lifecycle";
import {
	type AdaptedEntityType,
	getLifecycleAdapter,
	hasLifecycleAdapter,
} from "@/lib/data/lifecycle-adapters";
import type { Transaction } from "@/lib/db";
import { eq, inArray, sql } from "@/lib/db/sql";
import { assertSlugWithinMaxLength } from "@/lib/slug";

export interface EntityIdentity {
	id: string;
	slug: string;
	type: AdaptedEntityType;
}

export interface MergeEntitiesResult {
	sourceId: string;
	targetId: string;
	type: AdaptedEntityType;
}

async function loadMergeableEntity(tx: Transaction, documentId: string): Promise<EntityIdentity> {
	const row = await tx
		.select({ id: schema.entities.id, slug: schema.slugs.value, type: schema.entityTypes.type })
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(
			schema.slugs,
			sql`${schema.slugs.entityVersionId} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.where(eq(schema.entities.id, documentId))
		.then((rows) => rows[0]);

	assert(row, `Entity "${documentId}" not found.`);
	assert(
		hasLifecycleAdapter(row.type),
		`Entity type "${row.type}" cannot be merged (no lifecycle adapter).`,
	);

	return { id: row.id, slug: row.slug, type: row.type };
}

/**
 * Change an entity's slug. Slugs are normally system-managed; this is an admin-only maintenance
 * operation. The value is normalised with the same slugifier used at creation time; per-type,
 * per-locale uniqueness among _published_ slugs is enforced by the
 * `slugs_published_type_locale_value_unique` index — a conflict surfaces as the friendly "entity
 * slug already exists" message via `getUserFacingDatabaseError`.
 *
 * Updates the slug row for every version the document currently has (draft and/or published) in
 * lockstep, rather than only the draft's — the entity's slug is otherwise a single concept from the
 * caller's point of view, and a rename should take effect immediately rather than wait for the next
 * publish to sync it across.
 *
 * The caller is responsible for re-indexing the entity afterwards: the slug is part of the public
 * URL, so any external link to the old slug will 404 once this commits.
 */
export async function updateEntitySlug(
	tx: Transaction,
	documentId: string,
	rawSlug: string,
): Promise<EntityIdentity> {
	const entity = await loadMergeableEntity(tx, documentId);

	const slug = slugify(rawSlug);
	assert(slug.length > 0, "Slug must not be empty.");
	// This editor has no form schema in front of it, so the length limit is applied here — as a typed
	// error, since pasting a whole title in is an ordinary mistake and deserves a real message.
	assertSlugWithinMaxLength(slug);

	if (slug !== entity.slug) {
		const { draftId, publishedId } = await getDocumentVersions(tx, documentId);
		const versionIds = [draftId, publishedId].filter((id): id is string => id != null);

		await tx
			.update(schema.slugs)
			.set({ value: slug })
			.where(inArray(schema.slugs.entityVersionId, versionIds));
	}

	return { ...entity, slug };
}

// ---------------------------------------------------------------------------
// Re-pointing document-level relations
// ---------------------------------------------------------------------------

/**
 * Move childless relation rows keyed by a single entity endpoint from `source` to `target`,
 * deduping against rows the target already holds. `INSERT … ON CONFLICT DO NOTHING` covers both
 * unique/PK and exclusion constraints, so the target keeps its existing row and the redundant
 * source row is simply dropped by the subsequent delete. Used for tables that have no rows
 * referencing their own primary key (so re-creating the row under a fresh id is safe).
 */
async function repointEntitiesToEntities(
	tx: Transaction,
	source: string,
	target: string,
): Promise<void> {
	// entity_id endpoint. Skip rows that would become a self-relation (target,target).
	await tx.execute(sql`
		insert into entities_to_entities (entity_id, related_entity_id, position, created_at, updated_at)
		select ${target}, related_entity_id, position, created_at, updated_at
		from entities_to_entities
		where entity_id = ${source} and related_entity_id not in (${source}, ${target})
		on conflict do nothing
	`);
	await tx.delete(schema.entitiesToEntities).where(eq(schema.entitiesToEntities.entityId, source));

	// related_entity_id endpoint.
	await tx.execute(sql`
		insert into entities_to_entities (entity_id, related_entity_id, position, created_at, updated_at)
		select entity_id, ${target}, position, created_at, updated_at
		from entities_to_entities
		where related_entity_id = ${source} and entity_id not in (${source}, ${target})
		on conflict do nothing
	`);
	await tx
		.delete(schema.entitiesToEntities)
		.where(eq(schema.entitiesToEntities.relatedEntityId, source));
}

async function repointEntitiesToResources(
	tx: Transaction,
	source: string,
	target: string,
): Promise<void> {
	await tx.execute(sql`
		insert into entities_to_resources (entity_id, resource_id, position, created_at, updated_at)
		select ${target}, resource_id, position, created_at, updated_at
		from entities_to_resources
		where entity_id = ${source}
		on conflict do nothing
	`);
	await tx
		.delete(schema.entitiesToResources)
		.where(eq(schema.entitiesToResources.entityId, source));
}

async function repointProjectsToOrganisationalUnits(
	tx: Transaction,
	source: string,
	target: string,
): Promise<void> {
	// project endpoint (source is a project).
	await tx.execute(sql`
		insert into projects_to_organisational_units (project_document_id, unit_document_id, role_id, duration)
		select ${target}, unit_document_id, role_id, duration
		from projects_to_organisational_units
		where project_document_id = ${source}
		on conflict do nothing
	`);
	await tx
		.delete(schema.projectsToOrganisationalUnits)
		.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, source));

	// unit endpoint (source is an organisational unit).
	await tx.execute(sql`
		insert into projects_to_organisational_units (project_document_id, unit_document_id, role_id, duration)
		select project_document_id, ${target}, role_id, duration
		from projects_to_organisational_units
		where unit_document_id = ${source}
		on conflict do nothing
	`);
	await tx
		.delete(schema.projectsToOrganisationalUnits)
		.where(eq(schema.projectsToOrganisationalUnits.unitDocumentId, source));
}

async function repointOrganisationalUnitsRelations(
	tx: Transaction,
	source: string,
	target: string,
): Promise<void> {
	// unit endpoint. Skip rows that would become a self-relation with the target.
	await tx.execute(sql`
		insert into organisational_units_to_units (unit_document_id, related_unit_document_id, duration, status, description)
		select ${target}, related_unit_document_id, duration, status, description
		from organisational_units_to_units
		where unit_document_id = ${source} and related_unit_document_id not in (${source}, ${target})
		on conflict do nothing
	`);
	await tx
		.delete(schema.organisationalUnitsRelations)
		.where(eq(schema.organisationalUnitsRelations.unitDocumentId, source));

	// related-unit endpoint.
	await tx.execute(sql`
		insert into organisational_units_to_units (unit_document_id, related_unit_document_id, duration, status, description)
		select unit_document_id, ${target}, duration, status, description
		from organisational_units_to_units
		where related_unit_document_id = ${source} and unit_document_id not in (${source}, ${target})
		on conflict do nothing
	`);
	await tx
		.delete(schema.organisationalUnitsRelations)
		.where(eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, source));
}

async function repointArticleContributors(
	tx: Transaction,
	source: string,
	target: string,
): Promise<void> {
	// impact_case_studies_to_persons — article endpoint (source is an impact case study).
	await tx.execute(sql`
		insert into impact_case_studies_to_persons (impact_case_study_document_id, person_document_id, role, created_at, updated_at)
		select ${target}, person_document_id, role, created_at, updated_at
		from impact_case_studies_to_persons
		where impact_case_study_document_id = ${source}
		on conflict do nothing
	`);
	await tx
		.delete(schema.impactCaseStudiesToPersons)
		.where(eq(schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId, source));

	// impact_case_studies_to_persons — person endpoint (source is a person).
	await tx.execute(sql`
		insert into impact_case_studies_to_persons (impact_case_study_document_id, person_document_id, role, created_at, updated_at)
		select impact_case_study_document_id, ${target}, role, created_at, updated_at
		from impact_case_studies_to_persons
		where person_document_id = ${source}
		on conflict do nothing
	`);
	await tx
		.delete(schema.impactCaseStudiesToPersons)
		.where(eq(schema.impactCaseStudiesToPersons.personDocumentId, source));

	// spotlight_articles_to_persons — article endpoint (source is a spotlight article).
	await tx.execute(sql`
		insert into spotlight_articles_to_persons (spotlight_article_document_id, person_document_id, role, created_at, updated_at)
		select ${target}, person_document_id, role, created_at, updated_at
		from spotlight_articles_to_persons
		where spotlight_article_document_id = ${source}
		on conflict do nothing
	`);
	await tx
		.delete(schema.spotlightArticlesToPersons)
		.where(eq(schema.spotlightArticlesToPersons.spotlightArticleDocumentId, source));

	// spotlight_articles_to_persons — person endpoint (source is a person).
	await tx.execute(sql`
		insert into spotlight_articles_to_persons (spotlight_article_document_id, person_document_id, role, created_at, updated_at)
		select spotlight_article_document_id, ${target}, role, created_at, updated_at
		from spotlight_articles_to_persons
		where person_document_id = ${source}
		on conflict do nothing
	`);
	await tx
		.delete(schema.spotlightArticlesToPersons)
		.where(eq(schema.spotlightArticlesToPersons.personDocumentId, source));
}

/**
 * Re-point person↔org relations. These carry children keyed by the relation row id
 * (`country_report_contributions` and `working_group_report_chairs`), so the rows must be updated
 * in place (preserving the id) rather than re-inserted. A source row that would overlap an existing
 * target row (same other-endpoint + role + overlapping duration — the `person_org_role_no_overlap`
 * exclusion key) is deleted first (with its children, neither of which cascades), so the in-place
 * update cannot trip the exclusion constraint.
 */
async function repointPersonsToOrganisationalUnits(
	tx: Transaction,
	source: string,
	target: string,
): Promise<void> {
	// person endpoint (source is a person): collide on (org, role, duration).
	const overlappingByPerson = sql`
		select s.id from persons_to_organisational_units s
		where s.person_document_id = ${source} and exists (
			select 1 from persons_to_organisational_units t
			where t.person_document_id = ${target}
				and t.organisational_unit_document_id = s.organisational_unit_document_id
				and t.role_type_id = s.role_type_id
				and t.duration && s.duration
		)
	`;
	await tx.execute(sql`
		delete from country_report_contributions where person_to_org_unit_id in (${overlappingByPerson})
	`);
	await tx.execute(sql`
		delete from working_group_report_chairs where person_to_org_unit_id in (${overlappingByPerson})
	`);
	await tx.execute(sql`
		delete from persons_to_organisational_units s
		where s.person_document_id = ${source} and exists (
			select 1 from persons_to_organisational_units t
			where t.person_document_id = ${target}
				and t.organisational_unit_document_id = s.organisational_unit_document_id
				and t.role_type_id = s.role_type_id
				and t.duration && s.duration
		)
	`);
	await tx
		.update(schema.personsToOrganisationalUnits)
		.set({ personDocumentId: target })
		.where(eq(schema.personsToOrganisationalUnits.personDocumentId, source));

	// org endpoint (source is an organisational unit): collide on (person, role, duration).
	const overlappingByOrg = sql`
		select s.id from persons_to_organisational_units s
		where s.organisational_unit_document_id = ${source} and exists (
			select 1 from persons_to_organisational_units t
			where t.organisational_unit_document_id = ${target}
				and t.person_document_id = s.person_document_id
				and t.role_type_id = s.role_type_id
				and t.duration && s.duration
		)
	`;
	await tx.execute(sql`
		delete from country_report_contributions where person_to_org_unit_id in (${overlappingByOrg})
	`);
	await tx.execute(sql`
		delete from working_group_report_chairs where person_to_org_unit_id in (${overlappingByOrg})
	`);
	await tx.execute(sql`
		delete from persons_to_organisational_units s
		where s.organisational_unit_document_id = ${source} and exists (
			select 1 from persons_to_organisational_units t
			where t.organisational_unit_document_id = ${target}
				and t.person_document_id = s.person_document_id
				and t.role_type_id = s.role_type_id
				and t.duration && s.duration
		)
	`);
	await tx
		.update(schema.personsToOrganisationalUnits)
		.set({ organisationalUnitDocumentId: target })
		.where(eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, source));
}

/**
 * Re-point the remaining document-level references that are updated in place (they own child rows
 * or have no dedup concern). A rare unique collision here — e.g. both source and target already
 * hold a report in the same campaign — aborts the whole merge with a friendly "record conflict"
 * message, so the admin can resolve the conflicting reports before retrying, rather than silently
 * losing data.
 */
async function repointInPlaceReferences(
	tx: Transaction,
	source: string,
	target: string,
): Promise<void> {
	await tx
		.update(schema.servicesToOrganisationalUnits)
		.set({ organisationalUnitDocumentId: target })
		.where(eq(schema.servicesToOrganisationalUnits.organisationalUnitDocumentId, source));

	await tx
		.update(schema.countryReports)
		.set({ countryDocumentId: target })
		.where(eq(schema.countryReports.countryDocumentId, source));

	await tx
		.update(schema.workingGroupReports)
		.set({ workingGroupDocumentId: target })
		.where(eq(schema.workingGroupReports.workingGroupDocumentId, source));

	await tx
		.update(schema.countryReportProjectContributions)
		.set({ projectDocumentId: target })
		.where(eq(schema.countryReportProjectContributions.projectDocumentId, source));

	await tx
		.update(schema.countryReportInstitutions)
		.set({ organisationalUnitDocumentId: target })
		.where(eq(schema.countryReportInstitutions.organisationalUnitDocumentId, source));

	await tx
		.update(schema.reportingCampaignCountryThresholds)
		.set({ countryDocumentId: target })
		.where(eq(schema.reportingCampaignCountryThresholds.countryDocumentId, source));

	await tx
		.update(schema.users)
		.set({ personDocumentId: target })
		.where(eq(schema.users.personDocumentId, source));

	await tx
		.update(schema.users)
		.set({ organisationalUnitDocumentId: target })
		.where(eq(schema.users.organisationalUnitDocumentId, source));

	await tx
		.update(schema.navigationItems)
		.set({ entityId: target })
		.where(eq(schema.navigationItems.entityId, source));
}

// ---------------------------------------------------------------------------
// Teardown of the emptied source document
// ---------------------------------------------------------------------------

async function deleteSourceDocument(
	tx: Transaction,
	source: string,
	type: AdaptedEntityType,
): Promise<void> {
	const adapter = getLifecycleAdapter(type);
	const { draftId, publishedId } = await getDocumentVersions(tx, source);
	const versionIds = [draftId, publishedId].filter((id): id is string => id != null);

	for (const versionId of versionIds) {
		await adapter.wipeSubtype(tx, versionId);
	}

	for (const versionId of versionIds) {
		const fieldRows = await tx
			.select({ id: schema.fields.id })
			.from(schema.fields)
			.where(eq(schema.fields.entityVersionId, versionId));

		if (fieldRows.length > 0) {
			const fieldIds = fieldRows.map((f) => f.id);
			await tx.delete(schema.contentBlocks).where(inArray(schema.contentBlocks.fieldId, fieldIds));
			await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
		}
	}

	if (versionIds.length > 0) {
		// `slugs.entity_version_id` has no ON DELETE CASCADE, so the slug row for each version must go
		// before the version itself, or the delete below trips a foreign-key violation.
		await tx.delete(schema.slugs).where(inArray(schema.slugs.entityVersionId, versionIds));
		await tx.delete(schema.entityVersions).where(inArray(schema.entityVersions.id, versionIds));
	}

	// Safety net: everything was re-pointed above, so this removes nothing, but it guarantees no
	// stray document-level relation blocks the final delete.
	await deleteDocumentRelations(tx, source);

	await tx.delete(schema.entities).where(eq(schema.entities.id, source));
}

/**
 * Merge a duplicate entity into a canonical one: re-point every document-level relation from
 * `sourceId` onto `targetId`, then delete the emptied source document entirely. Top-level and
 * content fields are NOT merged — the target keeps its own, and the source's are discarded. Both
 * entities must be the same (mergeable) type.
 *
 * Runs inside the caller's transaction. The caller must re-index the target and remove the source
 * from the website search index afterwards.
 */
export async function mergeEntities(
	tx: Transaction,
	sourceId: string,
	targetId: string,
): Promise<MergeEntitiesResult> {
	assert(sourceId !== targetId, "Cannot merge an entity into itself.");

	const [source, target] = await Promise.all([
		loadMergeableEntity(tx, sourceId),
		loadMergeableEntity(tx, targetId),
	]);

	assert(
		source.type === target.type,
		`Cannot merge entities of different types (${source.type} → ${target.type}).`,
	);

	await repointEntitiesToEntities(tx, sourceId, targetId);
	await repointEntitiesToResources(tx, sourceId, targetId);
	await repointProjectsToOrganisationalUnits(tx, sourceId, targetId);
	await repointOrganisationalUnitsRelations(tx, sourceId, targetId);
	await repointArticleContributors(tx, sourceId, targetId);
	await repointPersonsToOrganisationalUnits(tx, sourceId, targetId);
	await repointInPlaceReferences(tx, sourceId, targetId);

	await deleteSourceDocument(tx, sourceId, source.type);

	return { sourceId, targetId, type: source.type };
}
