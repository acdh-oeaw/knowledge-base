import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import type { ResourceDocument, ResourceItem, SearchResourcesParams } from "@dariah-eric/search";

import { type Transaction, db } from "@/lib/db";
import { and, eq, sql } from "@/lib/db/sql";
import { search } from "@/lib/search";

export const countryExternalResourceSnapshotSections = [
	"country_sshoc_resources",
	"country_zotero_publications",
] as const satisfies ReadonlyArray<ReportExternalResourceSnapshotSection>;

export const workingGroupExternalResourceSnapshotSections = [
	"working_group_sshoc_resources",
	"working_group_zotero_publications",
] as const satisfies ReadonlyArray<ReportExternalResourceSnapshotSection>;

export type ReportExternalResourceSnapshotSection =
	(typeof schema.reportExternalResourceSnapshotSectionEnum)[number];

export interface ReportExternalResourceSnapshotItem {
	id: string;
	position: number;
	searchDocumentId: string;
	source: string;
	sourceId: string;
	sourceUpdatedAt: number | null;
	importedAt: number;
	type: string;
	sshocCategory: string | null;
	label: string;
	description: string;
	keywords: Array<string>;
	kind: string | null;
	sourceUrl: string | null;
	links: Array<string>;
	authors: Array<string> | null;
	year: number | null;
	pid: string | null;
}

export interface ReportExternalResourceSnapshot {
	id: string;
	section: ReportExternalResourceSnapshotSection;
	filterBy: string;
	actorSlugs: Array<string>;
	capturedAt: Date;
	capturedByUserName: string | null;
	items: Array<ReportExternalResourceSnapshotItem>;
}

interface ResourceSnapshotCapture {
	actorSlugs: Array<string>;
	filterBy: string;
	items: Array<ResourceItem>;
}

/**
 * Slugs of the national consortia related to `countryDocumentId` and active in the campaign `year`.
 * Unit↔unit relations and the report's country are document-level; the consortium owner is resolved
 * through its document and guarded by org-unit type. Used to filter the SSH Open Marketplace /
 * Zotero search by `national_consortia`.
 */
export async function getCountryConsortiumSlugs(
	countryDocumentId: string,
	year: number,
): Promise<Array<string>> {
	const rows = await db
		.select({ slug: schema.slugs.value })
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.organisationalUnitsRelations.unitDocumentId),
		)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(
			and(
				eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, countryDocumentId),
				eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
				eq(
					schema.organisationalUnitTypes.type,
					"national_consortium" as typeof schema.organisationalUnitTypes.$inferSelect.type,
				),
				sql`
					${schema.organisationalUnitsRelations.duration} && tstzrange (
						MAKE_DATE(${year}, 1, 1)::TIMESTAMPTZ,
						MAKE_DATE(${year + 1}, 1, 1)::TIMESTAMPTZ
					)
				`,
			),
		);

	return Array.from(new Set(rows.map((row) => row.slug)));
}

/** Slug of the working group document used in resource search facets. */
export async function getWorkingGroupSlug(workingGroupDocumentId: string): Promise<string | null> {
	const rows = await db
		.select({ slug: schema.slugs.value })
		.from(schema.documentLifecycle)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
		.where(eq(schema.documentLifecycle.documentId, workingGroupDocumentId))
		.limit(1);

	return rows[0]?.slug ?? null;
}

/** Display identity of the org unit that brands a report (consortium or working group). */
export interface ReportBranding {
	name: string;
	acronym: string | null;
	/** Storage key of the uploaded logo asset, or `null` when the unit has no image. */
	imageKey: string | null;
}

/**
 * Name, acronym, and logo asset key of the national consortium related to `countryDocumentId` and
 * active in the campaign `year`. Mirrors {@link getCountryConsortiumSlugs}' relation join but
 * resolves the unit's published-or-draft version and left-joins its image asset. Returns the first
 * match, or `null` when the country has no consortium for that period.
 */
export async function getCountryReportConsortiumBranding(
	countryDocumentId: string,
	year: number,
): Promise<ReportBranding | null> {
	const rows = await db
		.select({
			name: schema.organisationalUnits.name,
			acronym: schema.organisationalUnits.acronym,
			imageKey: schema.assets.key,
		})
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.organisationalUnitsRelations.unitDocumentId),
		)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.leftJoin(schema.assets, eq(schema.assets.id, schema.organisationalUnits.imageId))
		.where(
			and(
				eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, countryDocumentId),
				eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
				eq(
					schema.organisationalUnitTypes.type,
					"national_consortium" as typeof schema.organisationalUnitTypes.$inferSelect.type,
				),
				sql`
					${schema.organisationalUnitsRelations.duration} && tstzrange (
						MAKE_DATE(${year}, 1, 1)::TIMESTAMPTZ,
						MAKE_DATE(${year + 1}, 1, 1)::TIMESTAMPTZ
					)
				`,
			),
		)
		.limit(1);

	return rows[0] ?? null;
}

/** Name, acronym, and logo asset key of the working group document. */
export async function getWorkingGroupBranding(
	workingGroupDocumentId: string,
): Promise<ReportBranding | null> {
	const rows = await db
		.select({
			name: schema.organisationalUnits.name,
			acronym: schema.organisationalUnits.acronym,
			imageKey: schema.assets.key,
		})
		.from(schema.documentLifecycle)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.leftJoin(schema.assets, eq(schema.assets.id, schema.organisationalUnits.imageId))
		.where(eq(schema.documentLifecycle.documentId, workingGroupDocumentId))
		.limit(1);

	return rows[0] ?? null;
}

/**
 * Fetches every page of a resources search and returns the flattened items. Returns `[]` if the
 * first page errors; individual later-page errors are skipped.
 */
export async function searchAllResourcePages(
	params: SearchResourcesParams,
): Promise<Array<ResourceItem>> {
	const firstResult = await search.collections.resources.search({ ...params, page: 1 });
	if (!firstResult.isOk()) {
		return [];
	}

	const remainingResults = await Promise.all(
		Array.from({ length: Math.max(firstResult.value.pagination.totalPages - 1, 0) }, (_, index) =>
			search.collections.resources.search({ ...params, page: index + 2 }),
		),
	);

	return [
		...firstResult.value.items,
		...remainingResults.flatMap((result) => (result.isOk() ? result.value.items : [])),
	];
}

/** Fetches every resources-search page and throws if any page fails. Used by explicit refreshes. */
export async function searchAllResourcePagesStrict(
	params: SearchResourcesParams,
): Promise<Array<ResourceItem>> {
	const firstResult = await search.collections.resources.search({ ...params, page: 1 });
	if (firstResult.isErr()) {
		throw firstResult.error;
	}

	const remainingResults = await Promise.all(
		Array.from({ length: Math.max(firstResult.value.pagination.totalPages - 1, 0) }, (_, index) =>
			search.collections.resources.search({ ...params, page: index + 2 }),
		),
	);

	return [
		...firstResult.value.items,
		...remainingResults.flatMap((result) => {
			if (result.isErr()) {
				throw result.error;
			}

			return result.value.items;
		}),
	];
}

/** Builds the `national_consortia:=[...]` filter fragment from consortium slugs. */
export function nationalConsortiaFilter(slugs: ReadonlyArray<string>): string {
	return `national_consortia:=[${slugs.map((slug) => `\`${slug}\``).join(",")}]`;
}

function quoteFilterValue(value: string): string {
	return `\`${value.replaceAll("`", "\\`")}\``;
}

function listFilterValues(values: ReadonlyArray<string>): string {
	return `[${values.map((value) => quoteFilterValue(value)).join(",")}]`;
}

function deriveSshocCategory(document: ResourceDocument): string | null {
	if (document.source !== "ssh-open-marketplace") {
		return null;
	}

	switch (document.type) {
		case "service": {
			return "tool-or-service:service";
		}
		case "software": {
			return "tool-or-service:software";
		}
		case "training-material":
		case "workflow": {
			return document.type;
		}
	}
}

function getSearchBaseParams(): Omit<SearchResourcesParams, "filterBy"> {
	return {
		perPage: 100,
		query: "*",
		queryBy: ["label", "description", "keywords"],
		sortBy: [{ field: "label", direction: "asc" }],
	};
}

async function getCountryExternalResourceSnapshotCapture(
	countryDocumentId: string,
	year: number,
	section: (typeof countryExternalResourceSnapshotSections)[number],
): Promise<ResourceSnapshotCapture> {
	const consortiumSlugs = await getCountryConsortiumSlugs(countryDocumentId, year);

	switch (section) {
		case "country_sshoc_resources": {
			const filterBy = `source:=ssh-open-marketplace && type:=[${[
				"software",
				"training-material",
				"workflow",
			]
				.map((value) => quoteFilterValue(value))
				.join(",")}] && ${nationalConsortiaFilter(consortiumSlugs)}`;
			const items =
				consortiumSlugs.length === 0
					? []
					: await searchAllResourcePagesStrict({ ...getSearchBaseParams(), filterBy });

			return { actorSlugs: consortiumSlugs, filterBy, items };
		}

		case "country_zotero_publications": {
			const filterBy = `type:=publication && source:=zotero && year:=${year} && ${nationalConsortiaFilter(consortiumSlugs)}`;
			const items =
				consortiumSlugs.length === 0
					? []
					: await searchAllResourcePagesStrict({ ...getSearchBaseParams(), filterBy });

			return { actorSlugs: consortiumSlugs, filterBy, items };
		}
	}
}

async function getWorkingGroupExternalResourceSnapshotCapture(
	workingGroupDocumentId: string,
	year: number,
	section: (typeof workingGroupExternalResourceSnapshotSections)[number],
): Promise<ResourceSnapshotCapture> {
	const slug = await getWorkingGroupSlug(workingGroupDocumentId);
	const workingGroupSlugs = slug == null ? [] : [slug];
	const workingGroupFilter = listFilterValues(workingGroupSlugs);

	switch (section) {
		case "working_group_sshoc_resources": {
			const filterBy = `source:=ssh-open-marketplace && working_groups:=${workingGroupFilter}`;
			const items =
				slug == null
					? []
					: await searchAllResourcePagesStrict({ ...getSearchBaseParams(), filterBy });

			return { actorSlugs: workingGroupSlugs, filterBy, items };
		}

		case "working_group_zotero_publications": {
			const filterBy = `type:=publication && source:=zotero && year:=${year} && working_groups:=${workingGroupFilter}`;
			const items =
				slug == null
					? []
					: await searchAllResourcePagesStrict({ ...getSearchBaseParams(), filterBy });

			return { actorSlugs: workingGroupSlugs, filterBy, items };
		}
	}
}

function toSnapshotItemInput(
	snapshotId: string,
	item: ResourceItem,
	position: number,
): typeof schema.reportExternalResourceSnapshotItems.$inferInsert {
	const { document } = item;

	return {
		snapshotId,
		position,
		searchDocumentId: document.id,
		source: document.source,
		sourceId: document.source_id,
		sourceUpdatedAt: document.source_updated_at ?? null,
		importedAt: document.imported_at,
		type: document.type,
		sshocCategory: deriveSshocCategory(document),
		label: document.label,
		description: document.description,
		keywords: document.keywords,
		kind: document.kind,
		sourceUrl: document.source_url ?? null,
		links: document.links,
		authors: document.authors,
		year: document.year,
		pid: document.pid,
	};
}

async function replaceExternalResourceSnapshot(
	tx: Transaction,
	params: {
		actorSlugs: Array<string>;
		capturedByUserId: string | null;
		countryReportId?: string;
		filterBy: string;
		items: Array<ResourceItem>;
		section: ReportExternalResourceSnapshotSection;
		workingGroupReportId?: string;
	},
): Promise<string> {
	const ownerPredicate =
		params.countryReportId != null
			? eq(schema.reportExternalResourceSnapshots.countryReportId, params.countryReportId)
			: eq(
					schema.reportExternalResourceSnapshots.workingGroupReportId,
					params.workingGroupReportId!,
				);

	await tx
		.delete(schema.reportExternalResourceSnapshots)
		.where(and(ownerPredicate, eq(schema.reportExternalResourceSnapshots.section, params.section)));

	const [snapshot] = await tx
		.insert(schema.reportExternalResourceSnapshots)
		.values({
			actorSlugs: params.actorSlugs,
			capturedByUserId: params.capturedByUserId,
			countryReportId: params.countryReportId,
			filterBy: params.filterBy,
			section: params.section,
			workingGroupReportId: params.workingGroupReportId,
		})
		.returning({ id: schema.reportExternalResourceSnapshots.id });

	assert(snapshot, "External resource snapshot was not created.");

	if (params.items.length > 0) {
		await tx
			.insert(schema.reportExternalResourceSnapshotItems)
			.values(params.items.map((item, index) => toSnapshotItemInput(snapshot.id, item, index)));
	}

	return snapshot.id;
}

export async function refreshCountryExternalResourceSnapshot(
	tx: Transaction,
	params: {
		capturedByUserId: string | null;
		countryReportId: string;
		section: (typeof countryExternalResourceSnapshotSections)[number];
	},
): Promise<string> {
	const report = await tx.query.countryReports.findFirst({
		where: { id: params.countryReportId },
		columns: { countryDocumentId: true },
		with: { campaign: { columns: { year: true } } },
	});

	assert(report, "Country report not found.");

	const capture = await getCountryExternalResourceSnapshotCapture(
		report.countryDocumentId,
		report.campaign.year,
		params.section,
	);

	return replaceExternalResourceSnapshot(tx, {
		...capture,
		capturedByUserId: params.capturedByUserId,
		countryReportId: params.countryReportId,
		section: params.section,
	});
}

export async function refreshWorkingGroupExternalResourceSnapshot(
	tx: Transaction,
	params: {
		capturedByUserId: string | null;
		section: (typeof workingGroupExternalResourceSnapshotSections)[number];
		workingGroupReportId: string;
	},
): Promise<string> {
	const report = await tx.query.workingGroupReports.findFirst({
		where: { id: params.workingGroupReportId },
		columns: { workingGroupDocumentId: true },
		with: { campaign: { columns: { year: true } } },
	});

	assert(report, "Working group report not found.");

	const capture = await getWorkingGroupExternalResourceSnapshotCapture(
		report.workingGroupDocumentId,
		report.campaign.year,
		params.section,
	);

	return replaceExternalResourceSnapshot(tx, {
		...capture,
		capturedByUserId: params.capturedByUserId,
		section: params.section,
		workingGroupReportId: params.workingGroupReportId,
	});
}

export async function getCountryExternalResourceSnapshot(
	countryReportId: string,
	section: (typeof countryExternalResourceSnapshotSections)[number],
): Promise<ReportExternalResourceSnapshot | null> {
	return getExternalResourceSnapshot({ countryReportId, section });
}

export async function getWorkingGroupExternalResourceSnapshot(
	workingGroupReportId: string,
	section: (typeof workingGroupExternalResourceSnapshotSections)[number],
): Promise<ReportExternalResourceSnapshot | null> {
	return getExternalResourceSnapshot({ section, workingGroupReportId });
}

export async function getCountryExternalResourceSnapshots(
	countryReportId: string,
): Promise<Array<ReportExternalResourceSnapshot>> {
	const snapshots = await Promise.all(
		countryExternalResourceSnapshotSections.map((section) =>
			getCountryExternalResourceSnapshot(countryReportId, section),
		),
	);

	return snapshots.filter(
		(snapshot): snapshot is ReportExternalResourceSnapshot => snapshot != null,
	);
}

export async function getWorkingGroupExternalResourceSnapshots(
	workingGroupReportId: string,
): Promise<Array<ReportExternalResourceSnapshot>> {
	const snapshots = await Promise.all(
		workingGroupExternalResourceSnapshotSections.map((section) =>
			getWorkingGroupExternalResourceSnapshot(workingGroupReportId, section),
		),
	);

	return snapshots.filter(
		(snapshot): snapshot is ReportExternalResourceSnapshot => snapshot != null,
	);
}

async function getExternalResourceSnapshot(params: {
	countryReportId?: string;
	section: ReportExternalResourceSnapshotSection;
	workingGroupReportId?: string;
}): Promise<ReportExternalResourceSnapshot | null> {
	const where =
		params.countryReportId != null
			? {
					countryReportId: params.countryReportId,
					section: params.section,
				}
			: {
					section: params.section,
					workingGroupReportId: params.workingGroupReportId,
				};

	const snapshot = await db.query.reportExternalResourceSnapshots.findFirst({
		where,
		columns: {
			id: true,
			section: true,
			filterBy: true,
			actorSlugs: true,
			capturedAt: true,
		},
		with: {
			capturedByUser: { columns: { name: true } },
			items: {
				columns: {
					id: true,
					position: true,
					searchDocumentId: true,
					source: true,
					sourceId: true,
					sourceUpdatedAt: true,
					importedAt: true,
					type: true,
					sshocCategory: true,
					label: true,
					description: true,
					keywords: true,
					kind: true,
					sourceUrl: true,
					links: true,
					authors: true,
					year: true,
					pid: true,
				},
				orderBy: { position: "asc" },
			},
		},
	});

	if (snapshot == null) {
		return null;
	}

	return {
		id: snapshot.id,
		section: snapshot.section,
		filterBy: snapshot.filterBy,
		actorSlugs: snapshot.actorSlugs,
		capturedAt: snapshot.capturedAt,
		capturedByUserName: snapshot.capturedByUser?.name ?? null,
		items: snapshot.items,
	};
}
