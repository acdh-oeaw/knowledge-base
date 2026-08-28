import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import type { Transaction } from "@/lib/db";
import { eq, sql } from "@/lib/db/sql";
import { UserFacingError } from "@/lib/user-facing-error";

export interface ServiceIdentity {
	id: string;
	name: string;
	type: string;
	status: string;
	sshocMarketplaceId: string | null;
}

export interface MergeServicesResult {
	sourceId: string;
	targetId: string;
	source: ServiceIdentity;
	target: ServiceIdentity;
}

/**
 * The tables referencing a service, and the columns that decide whether two rows are the same link.
 * Together with {@link countryReportServiceKpis} this must cover every foreign key referencing
 * `services.id`; verify against the catalog rather than by grepping the schema:
 *
 * ```sql
 * select cl.relname, a.attname from pg_constraint c
 * join pg_class cl on cl.oid = c.conrelid
 * join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
 * where c.confrelid = to_regclass('services') and c.contype = 'f';
 * ```
 *
 * `services_to_organisational_units` dedupes on unit _and_ role: the same institution may
 * legitimately be both owner and provider of one service, so collapsing on the unit alone would
 * drop a real row.
 */
const linkTables = [
	{
		table: "services_to_organisational_units",
		columns: ["organisational_unit_document_id", "role_id"],
	},
	{ table: "services_to_social_media", columns: ["social_media_id"] },
	{ table: "country_report_services", columns: ["country_report_id"] },
] as const;

async function loadService(tx: Transaction, id: string): Promise<ServiceIdentity> {
	const row = await tx
		.select({
			id: schema.services.id,
			name: schema.services.name,
			type: schema.serviceTypes.type,
			status: schema.serviceStatuses.status,
			sshocMarketplaceId: schema.services.sshocMarketplaceId,
		})
		.from(schema.services)
		.innerJoin(schema.serviceTypes, eq(schema.services.typeId, schema.serviceTypes.id))
		.innerJoin(schema.serviceStatuses, eq(schema.services.statusId, schema.serviceStatuses.id))
		.where(eq(schema.services.id, id))
		.then((rows) => rows[0]);

	assert(row, `Service "${id}" not found.`);

	return row;
}

/**
 * Refuse the merge when both services carry a value for the same KPI in the same country report.
 * Re-pointing would trip the `(report, service, kpi)` unique key, and there is no safe way to
 * reconcile the two numbers automatically: summing assumes the duplicates tracked disjoint usage,
 * keeping one assumes the other was a double entry. Only an editor knows which, so the merge aborts
 * and they resolve the KPIs in the report first.
 *
 * Checked up front rather than left to the constraint so the failure carries this specific message
 * instead of a generic conflict.
 */
async function assertNoKpiConflicts(
	tx: Transaction,
	source: string,
	target: string,
): Promise<void> {
	const conflicts = await tx.execute(sql`
		select 1
		from country_report_service_kpis s
		join country_report_service_kpis t
			on t.country_report_id = s.country_report_id and t.kpi = s.kpi
		where s.service_id = ${source} and t.service_id = ${target}
		limit 1
	`);

	if (conflicts.rows.length > 0) {
		throw new UserFacingError("service-kpi-conflict");
	}
}

/**
 * Move link rows from `source` to `target`, dropping any that would duplicate a link the target
 * already holds. Neither `services_to_organisational_units` nor `services_to_social_media` has a
 * unique key, so `on conflict do nothing` would not dedupe them — a plain update would silently
 * leave the same unit listed twice on one service. The delete-then-update dedupes explicitly, which
 * also covers `country_report_services`, which does have the unique key.
 *
 * Not usable for `country_report_service_kpis`: its rows are unique per `(report, service, kpi)`
 * rather than per `(report, service)`, so deduping by report alone would discard source KPIs whose
 * category the target never recorded. Those rows are conflict-free by {@link assertNoKpiConflicts}
 * and move across wholesale instead.
 *
 * `table` and `columns` are trusted identifiers from {@link linkTables}, never user input.
 */
async function repointLinks(
	tx: Transaction,
	table: string,
	columns: ReadonlyArray<string>,
	source: string,
	target: string,
): Promise<void> {
	const linkTable = sql.identifier(table);
	const sameLink = sql.join(
		columns.map((column) => {
			const name = sql.identifier(column);
			return sql`tgt.${name} = src.${name}`;
		}),
		sql` and `,
	);

	await tx.execute(sql`
		delete from ${linkTable} src
		where src.service_id = ${source} and exists (
			select 1 from ${linkTable} tgt
			where tgt.service_id = ${target} and ${sameLink}
		)
	`);

	await tx.execute(sql`
		update ${linkTable} set service_id = ${target} where service_id = ${source}
	`);
}

/**
 * Merge a duplicate service into the canonical one: re-point every reference from `sourceId` onto
 * `targetId`, then delete the emptied source row. The target keeps its own name, type, status,
 * marketplace id, and flags — none of the source's fields are merged.
 *
 * This is the safe counterpart to deleting a service outright: `deleteServiceAction` drops the
 * source's country-report rows along with it, so a service that a past report reported KPIs against
 * takes that reporting history with it. Merging carries the history onto the canonical service
 * instead, which is what makes retiring a `needs_review` service (one the SSHOC marketplace no
 * longer lists) safe.
 *
 * Like social media, a service is a plain record: no versions, fields, or content blocks to tear
 * down, and it is not part of the website search index. Services of different types and statuses
 * may be merged — an internal duplicate of a marketplace-ingested service is exactly the kind this
 * folds into its canonical entry.
 *
 * Note that a source still listed in the SSHOC marketplace will simply be re-created by the next
 * ingest, which matches on `sshoc_marketplace_id`: the merge is durable only for services the
 * marketplace no longer returns (hence `needs_review`) or that were never ingested at all. The
 * caller is responsible for warning about that; it cannot be detected here.
 *
 * The referencing tables are hard-coded rather than discovered from the Postgres catalog because
 * each needs its own dedup rule. A link table added later is not silently missed: its rows still
 * reference the source, so the final delete fails on the foreign key and the merge rolls back.
 *
 * Runs inside the caller's transaction.
 */
export async function mergeServices(
	tx: Transaction,
	sourceId: string,
	targetId: string,
): Promise<MergeServicesResult> {
	assert(sourceId !== targetId, "Cannot merge a service into itself.");

	const [source, target] = await Promise.all([
		loadService(tx, sourceId),
		loadService(tx, targetId),
	]);

	await assertNoKpiConflicts(tx, sourceId, targetId);

	for (const { table, columns } of linkTables) {
		await repointLinks(tx, table, columns, sourceId, targetId);
	}

	await tx
		.update(schema.countryReportServiceKpis)
		.set({ serviceId: targetId })
		.where(eq(schema.countryReportServiceKpis.serviceId, sourceId));

	await tx.delete(schema.services).where(eq(schema.services.id, sourceId));

	return { sourceId, targetId, source, target };
}
