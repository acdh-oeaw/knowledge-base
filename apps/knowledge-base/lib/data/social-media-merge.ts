import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import type { Transaction } from "@/lib/db";
import { eq, sql } from "@/lib/db/sql";
import { UserFacingError } from "@/lib/user-facing-error";

export interface SocialMediaIdentity {
	id: string;
	name: string;
	url: string;
	type: string;
}

export interface MergeSocialMediaResult {
	sourceId: string;
	targetId: string;
	source: SocialMediaIdentity;
	target: SocialMediaIdentity;
}

/**
 * The tables linking an owner record to a social-media entry, and the column naming that owner.
 * Together with {@link countryReportSocialMediaKpis} this must cover every foreign key referencing
 * `social_media.id`; verify against the catalog rather than by grepping the schema:
 *
 * ```sql
 * select cl.relname, a.attname from pg_constraint c
 * join pg_class cl on cl.oid = c.conrelid
 * join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
 * where c.confrelid = to_regclass('social_media') and c.contype = 'f';
 * ```
 */
const linkTables = [
	{ table: "organisational_units_to_social_media", owner: "organisational_unit_id" },
	{ table: "projects_to_social_media", owner: "project_id" },
	{ table: "services_to_social_media", owner: "service_id" },
	{ table: "country_report_social_media", owner: "country_report_id" },
	{ table: "working_group_report_social_media", owner: "working_group_report_id" },
] as const;

async function loadSocialMedia(tx: Transaction, id: string): Promise<SocialMediaIdentity> {
	const row = await tx
		.select({
			id: schema.socialMedia.id,
			name: schema.socialMedia.name,
			url: schema.socialMedia.url,
			type: schema.socialMediaTypes.type,
		})
		.from(schema.socialMedia)
		.innerJoin(schema.socialMediaTypes, eq(schema.socialMedia.typeId, schema.socialMediaTypes.id))
		.where(eq(schema.socialMedia.id, id))
		.then((rows) => rows[0]);

	assert(row, `Social-media entry "${id}" not found.`);

	return row;
}

/**
 * Refuse the merge when both accounts carry a value for the same KPI in the same country report.
 * Re-pointing would trip the `(report, social media, kpi)` unique key, and there is no safe way to
 * reconcile the two numbers automatically: summing assumes the duplicates tracked disjoint
 * activity, keeping one assumes the other was a double entry. Only an editor knows which, so the
 * merge aborts and they resolve the KPIs in the report first.
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
		from country_report_social_media_kpis s
		join country_report_social_media_kpis t
			on t.country_report_id = s.country_report_id and t.kpi = s.kpi
		where s.social_media_id = ${source} and t.social_media_id = ${target}
		limit 1
	`);

	if (conflicts.rows.length > 0) {
		throw new UserFacingError("social-media-kpi-conflict");
	}
}

/**
 * Move link rows from `source` to `target`, dropping any that would duplicate a link the target
 * already holds on the same owner. The organisational-unit, project, and service link tables have
 * no unique key on `(owner, social_media_id)`, so `on conflict do nothing` would not dedupe them —
 * a plain update would silently leave the same account listed twice on one unit. The
 * delete-then-update therefore dedupes explicitly, which also covers the reporting tables that do
 * have the unique key.
 *
 * Not usable for `country_report_social_media_kpis`: its rows are unique per `(owner, account,
 * kpi)` rather than per `(owner, account)`, so deduping by owner alone would discard source KPIs
 * whose category the target never recorded. Those rows are conflict-free by
 * {@link assertNoKpiConflicts} and move across wholesale instead.
 *
 * `table` and `ownerColumn` are trusted identifiers from {@link linkTables}, never user input.
 */
async function repointLinks(
	tx: Transaction,
	table: string,
	ownerColumn: string,
	source: string,
	target: string,
): Promise<void> {
	const linkTable = sql.identifier(table);
	const owner = sql.identifier(ownerColumn);

	await tx.execute(sql`
		delete from ${linkTable} src
		where src.social_media_id = ${source} and exists (
			select 1 from ${linkTable} tgt
			where tgt.social_media_id = ${target} and tgt.${owner} = src.${owner}
		)
	`);

	await tx.execute(sql`
		update ${linkTable} set social_media_id = ${target} where social_media_id = ${source}
	`);
}

/**
 * Merge a duplicate social-media account into the canonical one: re-point every reference from
 * `sourceId` onto `targetId`, then delete the emptied source row. The target keeps its own name,
 * url, type, and duration — none of the source's fields are merged.
 *
 * Unlike entities, a social-media row is a plain record: no versions, fields, or content blocks to
 * tear down, and it is not part of the website search index. Accounts of different types may be
 * merged — an account mis-filed as `other` is exactly the kind of duplicate this folds into its
 * canonical entry.
 *
 * The referencing tables are hard-coded rather than discovered from the Postgres catalog (as the
 * cleanup service does) because each needs its own dedup rule. A link table added later is not
 * silently missed: its rows still reference the source, so the final delete fails on the foreign
 * key and the merge rolls back.
 *
 * Note that the reporting links are curated per report and carried over year to year, so a merge
 * rewrites which account historical reports point at.
 *
 * Runs inside the caller's transaction.
 */
export async function mergeSocialMedia(
	tx: Transaction,
	sourceId: string,
	targetId: string,
): Promise<MergeSocialMediaResult> {
	assert(sourceId !== targetId, "Cannot merge a social-media entry into itself.");

	const [source, target] = await Promise.all([
		loadSocialMedia(tx, sourceId),
		loadSocialMedia(tx, targetId),
	]);

	await assertNoKpiConflicts(tx, sourceId, targetId);

	for (const { table, owner } of linkTables) {
		await repointLinks(tx, table, owner, sourceId, targetId);
	}

	await tx
		.update(schema.countryReportSocialMediaKpis)
		.set({ socialMediaId: targetId })
		.where(eq(schema.countryReportSocialMediaKpis.socialMediaId, sourceId));

	await tx.delete(schema.socialMedia).where(eq(schema.socialMedia.id, sourceId));

	return { sourceId, targetId, source, target };
}
