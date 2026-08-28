import { unique } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { type Database, type Transaction, db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import {
	type SQL,
	type SQLWrapper,
	alias,
	and,
	count,
	desc,
	eq,
	inArray,
	or,
	sql,
} from "@/lib/db/sql";

/** A db handle usable for reads — the global pool, or an open transaction (for write-time reads). */
type AuditLogClient = Database | Transaction;

export type AuditLogAction = (typeof schema.auditLogActionEnum)[number];

function isUuid(value: string): boolean {
	return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu.test(value);
}

export const auditLogActions = schema.auditLogActionEnum;

export interface AuditLogEntry {
	id: string;
	action: AuditLogAction;
	subjectType: string;
	subjectId: string;
	/** Human-readable label for the subject, falling back to `<type> #<id>` when unresolved. */
	subjectLabel: string;
	/** Human-readable actor (`name (email)`), or "System" when no actor was recorded. */
	actorLabel: string;
	summary: Record<string, unknown>;
	createdAt: Date;
}

export interface GetAuditLogEntriesParams {
	limit: number;
	offset: number;
	action?: AuditLogAction;
	/** Free-text query matched against the subject label (and subject id). */
	q?: string;
}

export interface AuditLogResult {
	data: Array<AuditLogEntry>;
	total: number;
}

function humanizeSubjectType(subjectType: string): string {
	return subjectType.replaceAll("_", " ");
}

// ---------------------------------------------------------------------------
// Subject label sources
//
// Every source composes its label in SQL rather than in JS, so the exact same expression can both
// be selected (to render a row) and be matched against (to filter the list). Composing them in JS
// instead would mean the search silently disagreeing with what the table shows.
// ---------------------------------------------------------------------------

/** An `(id, label)` pair contributed by one subject-label source. */
interface SubjectLabelRow {
	id: string;
	label: string | null;
}

interface SubjectLabelSource {
	/** The primary key that audit `subject_id` values point at. */
	id: SQLWrapper;
	/** The composed, human-readable label. */
	label: SQLWrapper;
	/** Runs the source's joins under `where` and returns the labels it owns. */
	select: (client: AuditLogClient, where: SQL) => Promise<Array<SubjectLabelRow>>;
}

/**
 * The version a document currently resolves through — its draft if it has one, else its published
 * one.
 */
const documentVersionId = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;

/**
 * A single left-joined `COALESCE` over every subtype table resolves any entity type in one round
 * trip — non-matching ids (reports, navigation, assets, ...) simply yield `null` and are handled by
 * the other sources / the fallback label.
 */
const entityDocumentLabel = sql<
	string | null
>`COALESCE(${schema.news.title}, ${schema.events.title}, ${schema.pages.title}, ${schema.opportunities.title}, ${schema.fundingCalls.title}, ${schema.impactCaseStudies.title}, ${schema.spotlightArticles.title}, ${schema.documentsPolicies.title}, ${schema.documentationPages.title}, ${schema.internalPages.title}, ${schema.persons.name}, ${schema.projects.name}, ${schema.organisationalUnits.name})`;

/** Resolves entity-document ids (which are `entities.id` document ids) to their current title/name. */
function selectEntityDocumentLabels(
	client: AuditLogClient,
	where: SQL,
): Promise<Array<SubjectLabelRow>> {
	return client
		.select({ id: schema.documentLifecycle.documentId, label: entityDocumentLabel })
		.from(schema.documentLifecycle)
		.leftJoin(schema.news, eq(schema.news.id, documentVersionId))
		.leftJoin(schema.events, eq(schema.events.id, documentVersionId))
		.leftJoin(schema.pages, eq(schema.pages.id, documentVersionId))
		.leftJoin(schema.opportunities, eq(schema.opportunities.id, documentVersionId))
		.leftJoin(schema.fundingCalls, eq(schema.fundingCalls.id, documentVersionId))
		.leftJoin(schema.impactCaseStudies, eq(schema.impactCaseStudies.id, documentVersionId))
		.leftJoin(schema.spotlightArticles, eq(schema.spotlightArticles.id, documentVersionId))
		.leftJoin(schema.documentsPolicies, eq(schema.documentsPolicies.id, documentVersionId))
		.leftJoin(schema.documentationPages, eq(schema.documentationPages.id, documentVersionId))
		.leftJoin(schema.internalPages, eq(schema.internalPages.id, documentVersionId))
		.leftJoin(schema.persons, eq(schema.persons.id, documentVersionId))
		.leftJoin(schema.projects, eq(schema.projects.id, documentVersionId))
		.leftJoin(schema.organisationalUnits, eq(schema.organisationalUnits.id, documentVersionId))
		.where(where);
}

/**
 * Resolves a single entity document id to its current version's title/name. Pass the active
 * transaction and call this _before_ the entity is deleted; the result is meant to be stored as the
 * audit row's `subjectLabel` (see {@link resolveAuditSubjectLabel}).
 */
export async function resolveEntityDocumentLabel(
	client: AuditLogClient,
	documentId: string,
): Promise<string | null> {
	const rows = await selectEntityDocumentLabels(
		client,
		eq(schema.documentLifecycle.documentId, documentId),
	);
	return rows.at(0)?.label ?? null;
}

/** Resolves asset ids to their media-library label. */
function selectAssetLabels(client: AuditLogClient, where: SQL): Promise<Array<SubjectLabelRow>> {
	return client
		.select({ id: schema.assets.id, label: schema.assets.label })
		.from(schema.assets)
		.where(where);
}

/** Resolves a single asset id to its media-library label. */
export async function resolveAssetLabel(
	client: AuditLogClient,
	assetId: string,
): Promise<string | null> {
	const rows = await selectAssetLabels(client, eq(schema.assets.id, assetId));
	return rows.at(0)?.label ?? null;
}

/** Resolves `services.id` / `social_media.id` (etc.) to their `name`. */
function selectNamedRecordLabels(
	client: AuditLogClient,
	table: typeof schema.services | typeof schema.socialMedia,
	where: SQL,
): Promise<Array<SubjectLabelRow>> {
	return client.select({ id: table.id, label: table.name }).from(table).where(where);
}

/** Resolves a single `services.id` / `social_media.id` (etc.) to its `name`. */
async function resolveNamedRecordLabel(
	client: AuditLogClient,
	table: typeof schema.services | typeof schema.socialMedia,
	id: string,
): Promise<string | null> {
	const rows = await selectNamedRecordLabels(client, table, eq(table.id, id));
	return rows.at(0)?.label ?? null;
}

const reportLabel = sql<
	string | null
>`${schema.organisationalUnits.name} || ' ' || ${schema.reportingCampaigns.year}::text`;

/** Resolves country report ids to "<org unit name> <campaign year>". */
function selectCountryReportLabels(
	client: AuditLogClient,
	where: SQL,
): Promise<Array<SubjectLabelRow>> {
	return client
		.select({ id: schema.countryReports.id, label: reportLabel })
		.from(schema.countryReports)
		.innerJoin(
			schema.reportingCampaigns,
			eq(schema.reportingCampaigns.id, schema.countryReports.campaignId),
		)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.countryReports.countryDocumentId),
		)
		.innerJoin(schema.organisationalUnits, eq(schema.organisationalUnits.id, documentVersionId))
		.where(where);
}

/** Resolves working-group report ids to "<org unit name> <campaign year>". */
function selectWorkingGroupReportLabels(
	client: AuditLogClient,
	where: SQL,
): Promise<Array<SubjectLabelRow>> {
	return client
		.select({ id: schema.workingGroupReports.id, label: reportLabel })
		.from(schema.workingGroupReports)
		.innerJoin(
			schema.reportingCampaigns,
			eq(schema.reportingCampaigns.id, schema.workingGroupReports.campaignId),
		)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.workingGroupReports.workingGroupDocumentId),
		)
		.innerJoin(schema.organisationalUnits, eq(schema.organisationalUnits.id, documentVersionId))
		.where(where);
}

async function resolveReportLabel(client: AuditLogClient, id: string): Promise<string | null> {
	const [countryReports, workingGroupReports] = await Promise.all([
		selectCountryReportLabels(client, eq(schema.countryReports.id, id)),
		selectWorkingGroupReportLabels(client, eq(schema.workingGroupReports.id, id)),
	]);
	return countryReports.at(0)?.label ?? workingGroupReports.at(0)?.label ?? null;
}

const campaignLabel = sql<
	string | null
>`'Reporting campaign ' || ${schema.reportingCampaigns.year}::text`;

/** Resolves reporting-campaign ids to "Reporting campaign <year>". */
function selectCampaignLabels(client: AuditLogClient, where: SQL): Promise<Array<SubjectLabelRow>> {
	return client
		.select({ id: schema.reportingCampaigns.id, label: campaignLabel })
		.from(schema.reportingCampaigns)
		.where(where);
}

const contributionPersonLifecycle = alias(
	schema.documentLifecycle,
	"contribution_person_lifecycle",
);
const contributionUnitLifecycle = alias(schema.documentLifecycle, "contribution_unit_lifecycle");
const contributionPersonVersionId = sql`COALESCE(${contributionPersonLifecycle.draftId}, ${contributionPersonLifecycle.publishedId})`;
const contributionUnitVersionId = sql`COALESCE(${contributionUnitLifecycle.draftId}, ${contributionUnitLifecycle.publishedId})`;

const contributionLabel = sql<
	string | null
>`COALESCE(${schema.persons.name}, 'Unknown person') || ' — ' || COALESCE(REPLACE(${schema.personRoleTypes.type}, '_', ' '), 'contributor') || ' at ' || COALESCE(${schema.organisationalUnits.name}, 'unknown organisation')`;

/**
 * Resolves contribution ids (`persons_to_organisational_units.id`) to "<person> — <role> at <org
 * unit>". Both endpoints are `entities.id` document ids, so each is resolved through its
 * draft-or-published version, matching the admin-side reads.
 */
function selectContributionLabels(
	client: AuditLogClient,
	where: SQL,
): Promise<Array<SubjectLabelRow>> {
	return client
		.select({ id: schema.personsToOrganisationalUnits.id, label: contributionLabel })
		.from(schema.personsToOrganisationalUnits)
		.leftJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.leftJoin(
			contributionPersonLifecycle,
			eq(
				contributionPersonLifecycle.documentId,
				schema.personsToOrganisationalUnits.personDocumentId,
			),
		)
		.leftJoin(schema.persons, eq(schema.persons.id, contributionPersonVersionId))
		.leftJoin(
			contributionUnitLifecycle,
			eq(
				contributionUnitLifecycle.documentId,
				schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			),
		)
		.leftJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, contributionUnitVersionId),
		)
		.where(where);
}

const unitRelationUnitLifecycle = alias(schema.documentLifecycle, "unit_relation_unit_lifecycle");
const unitRelationRelatedLifecycle = alias(
	schema.documentLifecycle,
	"unit_relation_related_lifecycle",
);
const relatedOrganisationalUnits = alias(
	schema.organisationalUnits,
	"related_organisational_units",
);
const unitRelationUnitVersionId = sql`COALESCE(${unitRelationUnitLifecycle.draftId}, ${unitRelationUnitLifecycle.publishedId})`;
const unitRelationRelatedVersionId = sql`COALESCE(${unitRelationRelatedLifecycle.draftId}, ${unitRelationRelatedLifecycle.publishedId})`;

const unitRelationLabel = sql<
	string | null
>`COALESCE(${schema.organisationalUnits.name}, 'Unknown unit') || ' → ' || COALESCE(${relatedOrganisationalUnits.name}, 'unknown unit') || ' (' || COALESCE(REPLACE(${schema.organisationalUnitStatus.status}, '_', ' '), 'related') || ')'`;

/**
 * Resolves unit-relation ids (`organisational_units_to_units.id`) to "<unit> → <related unit>
 * (<status>)". Both endpoints are `entities.id` document ids, resolved through their
 * draft-or-published versions.
 */
function selectUnitRelationLabels(
	client: AuditLogClient,
	where: SQL,
): Promise<Array<SubjectLabelRow>> {
	return client
		.select({ id: schema.organisationalUnitsRelations.id, label: unitRelationLabel })
		.from(schema.organisationalUnitsRelations)
		.leftJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.leftJoin(
			unitRelationUnitLifecycle,
			eq(unitRelationUnitLifecycle.documentId, schema.organisationalUnitsRelations.unitDocumentId),
		)
		.leftJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, unitRelationUnitVersionId),
		)
		.leftJoin(
			unitRelationRelatedLifecycle,
			eq(
				unitRelationRelatedLifecycle.documentId,
				schema.organisationalUnitsRelations.relatedUnitDocumentId,
			),
		)
		.leftJoin(
			relatedOrganisationalUnits,
			eq(relatedOrganisationalUnits.id, unitRelationRelatedVersionId),
		)
		.where(where);
}

/**
 * Every source of a live subject label, in precedence order. The subject id spaces are disjoint
 * (entity document ids vs report ids vs campaign ids vs contribution ids vs unit-relation ids), so
 * each source is handed every id and contributes only the ones it owns.
 */
const subjectLabelSources: ReadonlyArray<SubjectLabelSource> = [
	{
		id: schema.documentLifecycle.documentId,
		label: entityDocumentLabel,
		select: selectEntityDocumentLabels,
	},
	{ id: schema.assets.id, label: schema.assets.label, select: selectAssetLabels },
	{
		id: schema.socialMedia.id,
		label: schema.socialMedia.name,
		select: (client, where) => selectNamedRecordLabels(client, schema.socialMedia, where),
	},
	{
		id: schema.services.id,
		label: schema.services.name,
		select: (client, where) => selectNamedRecordLabels(client, schema.services, where),
	},
	{ id: schema.countryReports.id, label: reportLabel, select: selectCountryReportLabels },
	{ id: schema.workingGroupReports.id, label: reportLabel, select: selectWorkingGroupReportLabels },
	{ id: schema.reportingCampaigns.id, label: campaignLabel, select: selectCampaignLabels },
	{
		id: schema.personsToOrganisationalUnits.id,
		label: contributionLabel,
		select: selectContributionLabels,
	},
	{
		id: schema.organisationalUnitsRelations.id,
		label: unitRelationLabel,
		select: selectUnitRelationLabels,
	},
];

/** Resolves subject ids to their current label, merging the sources in precedence order. */
async function resolveSubjectLabels(
	client: AuditLogClient,
	ids: Array<string>,
): Promise<Map<string, string>> {
	if (ids.length === 0) {
		return new Map();
	}

	const results = await Promise.all(
		subjectLabelSources.map((source) => source.select(client, inArray(source.id, ids))),
	);

	const labels = new Map<string, string>();
	for (const rows of results) {
		for (const row of rows) {
			if (row.label != null && !labels.has(row.id)) {
				labels.set(row.id, row.label);
			}
		}
	}
	return labels;
}

/**
 * Finds the subject ids whose current label matches every term in `query`. Matching happens against
 * the same composed expressions that produce the labels shown in the table, so a search hits
 * exactly what the "Subject" column renders.
 */
export async function findAuditSubjectIdsMatching(
	query: string,
	client: AuditLogClient = db,
): Promise<Array<string>> {
	const results = await Promise.all(
		subjectLabelSources.map(async (source) => {
			const where = matchesAllTerms(query, source.label);
			return where != null ? source.select(client, where) : [];
		}),
	);

	return unique(results.flat().map((row) => row.id));
}

async function resolveActorLabels(
	client: AuditLogClient,
	actorIds: Array<string>,
): Promise<Map<string, string>> {
	if (actorIds.length === 0) {
		return new Map();
	}

	const rows = await client
		.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
		.from(schema.users)
		.where(inArray(schema.users.id, actorIds));

	return new Map(rows.map((row) => [row.id, `${row.name} (${row.email})`]));
}

/** Resolves a navigation id, trying menu-item labels first, then top-level menu names. */
async function resolveNavigationLabel(client: AuditLogClient, id: string): Promise<string | null> {
	const [item] = await client
		.select({ label: schema.navigationItems.label })
		.from(schema.navigationItems)
		.where(eq(schema.navigationItems.id, id))
		.limit(1);
	if (item?.label != null) {
		return item.label;
	}

	const [menu] = await client
		.select({ name: schema.navigationMenus.name })
		.from(schema.navigationMenus)
		.where(eq(schema.navigationMenus.id, id))
		.limit(1);
	return menu?.name ?? null;
}

/** Resolves a `projects_to_organisational_units.id` to "<project> — <organisation>". */
async function resolveProjectPartnerLabel(
	client: AuditLogClient,
	id: string,
): Promise<string | null> {
	const projectLifecycle = alias(schema.documentLifecycle, "project_partner_project_lifecycle");
	const unitLifecycle = alias(schema.documentLifecycle, "project_partner_unit_lifecycle");
	const projectVersionId = sql`COALESCE(${projectLifecycle.draftId}, ${projectLifecycle.publishedId})`;
	const unitVersionId = sql`COALESCE(${unitLifecycle.draftId}, ${unitLifecycle.publishedId})`;

	const [row] = await client
		.select({ projectName: schema.projects.name, unitName: schema.organisationalUnits.name })
		.from(schema.projectsToOrganisationalUnits)
		.leftJoin(
			projectLifecycle,
			eq(projectLifecycle.documentId, schema.projectsToOrganisationalUnits.projectDocumentId),
		)
		.leftJoin(schema.projects, eq(schema.projects.id, projectVersionId))
		.leftJoin(
			unitLifecycle,
			eq(unitLifecycle.documentId, schema.projectsToOrganisationalUnits.unitDocumentId),
		)
		.leftJoin(schema.organisationalUnits, eq(schema.organisationalUnits.id, unitVersionId))
		.where(eq(schema.projectsToOrganisationalUnits.id, id))
		.limit(1);

	if (row == null) {
		return null;
	}
	const project = row.projectName ?? "Unknown project";
	const unit = row.unitName ?? "unknown organisation";
	return `${project} — ${unit}`;
}

/**
 * Subject types whose id is an `entities.id` document id (resolved via the current version).
 * Includes the organisational-unit subtypes (`countries`, `institutions`, ...) — they all resolve
 * through `organisational_units.name` regardless of the discriminator carried in the subject type.
 */
const entityDocumentSubjectTypes = new Set([
	"news",
	"events",
	"pages",
	"opportunities",
	"funding_calls",
	"impact_case_studies",
	"spotlight_articles",
	"documents_policies",
	"documentation_pages",
	"internal_pages",
	"persons",
	"projects",
	"organisational_units",
	"countries",
	"institutions",
	"national_consortia",
	"working_groups",
	"governance_bodies",
]);

/**
 * Resolves a single subject to its human-readable label, dispatching on `subjectType`. Call this at
 * write time — before the subject row is deleted — and pass the result as `recordAuditEvent`'s
 * `subjectLabel`, so the audit log keeps a readable label even though the subject no longer
 * exists.
 *
 * Returns `null` when the subject can't be resolved (unknown type, non-uuid id, or a subtype id
 * that doesn't map cleanly, e.g. a document-policy _group_ under the `documents_policies` type);
 * callers that know a better label for those cases should pass it explicitly instead.
 */
export async function resolveAuditSubjectLabel(
	subjectType: string,
	subjectId: string,
	client: AuditLogClient = db,
): Promise<string | null> {
	if (!isUuid(subjectId)) {
		return null;
	}

	if (entityDocumentSubjectTypes.has(subjectType)) {
		return resolveEntityDocumentLabel(client, subjectId);
	}

	switch (subjectType) {
		case "assets": {
			return resolveAssetLabel(client, subjectId);
		}
		case "country_reports":
		case "working_group_reports": {
			return resolveReportLabel(client, subjectId);
		}
		case "reporting_campaigns": {
			const rows = await selectCampaignLabels(client, eq(schema.reportingCampaigns.id, subjectId));
			return rows.at(0)?.label ?? null;
		}
		case "contributions": {
			const rows = await selectContributionLabels(
				client,
				eq(schema.personsToOrganisationalUnits.id, subjectId),
			);
			return rows.at(0)?.label ?? null;
		}
		case "unit_relations": {
			const rows = await selectUnitRelationLabels(
				client,
				eq(schema.organisationalUnitsRelations.id, subjectId),
			);
			return rows.at(0)?.label ?? null;
		}
		case "users": {
			return (await resolveActorLabels(client, [subjectId])).get(subjectId) ?? null;
		}
		case "project_partners": {
			return resolveProjectPartnerLabel(client, subjectId);
		}
		case "social_media": {
			return resolveNamedRecordLabel(client, schema.socialMedia, subjectId);
		}
		case "internal_services": {
			return resolveNamedRecordLabel(client, schema.services, subjectId);
		}
		case "navigation": {
			return resolveNavigationLabel(client, subjectId);
		}
		default: {
			return null;
		}
	}
}

/**
 * Builds the `WHERE` for a subject search. A row matches when the query matches its snapshotted
 * label, its subject id, or the label its subject currently resolves to. The live match is not
 * gated on the snapshot being absent: for a renamed subject the table shows the event-time name,
 * but an audit log that hides events because the entity has since been renamed is worse than one
 * that occasionally shows a row whose displayed label is the older spelling of the search term.
 */
function createSubjectSearchWhere(
	query: string,
	matchingSubjectIds: Array<string>,
): SQL | undefined {
	return or(
		matchesAllTerms(query, schema.auditLogs.subjectLabel),
		matchesAllTerms(query, schema.auditLogs.subjectId),
		matchingSubjectIds.length > 0
			? inArray(schema.auditLogs.subjectId, matchingSubjectIds)
			: undefined,
	);
}

export async function getAuditLogEntries(
	params: Readonly<GetAuditLogEntriesParams>,
): Promise<AuditLogResult> {
	const { limit, offset, action, q = "" } = params;

	const where = and(
		action != null ? eq(schema.auditLogs.action, action) : undefined,
		q !== "" ? createSubjectSearchWhere(q, await findAuditSubjectIdsMatching(q)) : undefined,
	);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.auditLogs.id,
				action: schema.auditLogs.action,
				subjectType: schema.auditLogs.subjectType,
				subjectId: schema.auditLogs.subjectId,
				subjectLabel: schema.auditLogs.subjectLabel,
				summary: schema.auditLogs.summary,
				createdAt: schema.auditLogs.createdAt,
				actorUserId: schema.auditLogs.actorUserId,
				impersonatedByUserId: schema.auditLogs.impersonatedByUserId,
			})
			.from(schema.auditLogs)
			.where(where)
			.orderBy(desc(schema.auditLogs.createdAt))
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(schema.auditLogs).where(where),
	]);

	const subjectIds = unique(items.map((item) => item.subjectId));
	const actorIds = unique(
		items
			.flatMap((item) => [item.actorUserId, item.impersonatedByUserId])
			.filter((id): id is string => id != null),
	);

	// `subjectId` is a free-form text column, so it can hold non-uuid sentinels (e.g. "all" for
	// global/bulk actions). The sources below all match against uuid-typed columns, so feeding them a
	// non-uuid would make Postgres fail casting it to uuid. Filter to uuid-shaped ids; anything else
	// falls through to the `<type> #<id>` fallback label.
	const uuidSubjectIds = subjectIds.filter((id) => isUuid(id));

	const [subjectLabels, actorLabels] = await Promise.all([
		resolveSubjectLabels(db, uuidSubjectIds),
		resolveActorLabels(db, actorIds),
	]);

	const data: Array<AuditLogEntry> = items.map((item) => {
		// A label snapshotted at write time (see `resolveAuditSubjectLabel`) wins: it's the only source
		// that survives the subject being deleted. Otherwise resolve live from the current version so
		// renames stay reflected, and fall back to `<type> #<id>` when nothing resolves.
		const subjectLabel =
			item.subjectLabel ??
			subjectLabels.get(item.subjectId) ??
			`${humanizeSubjectType(item.subjectType)} #${item.subjectId}`;

		function resolveActorLabel(id: string | null): string {
			return id == null ? "System" : (actorLabels.get(id) ?? `Unknown user #${id}`);
		}

		// Attributed to the account the change was made under, with the impersonating admin named
		// alongside it -- the impersonated user reading their own history needs to see both.
		const actorLabel =
			item.impersonatedByUserId == null
				? resolveActorLabel(item.actorUserId)
				: `${resolveActorLabel(item.actorUserId)} (via ${resolveActorLabel(item.impersonatedByUserId)})`;

		return {
			id: item.id,
			action: item.action,
			subjectType: item.subjectType,
			subjectId: item.subjectId,
			subjectLabel,
			actorLabel,
			summary: (item.summary ?? {}) as Record<string, unknown>,
			createdAt: item.createdAt,
		};
	});

	return { data, total: aggregate.at(0)?.total ?? 0 };
}
