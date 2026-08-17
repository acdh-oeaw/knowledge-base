import * as schema from "@dariah-eric/database/schema";

import type { Database, Transaction } from "@/lib/db";
import { type SQL, and, eq, inArray, or, sql } from "@/lib/db/sql";

/**
 * Pick exactly one version row per entity, preferring the draft when one exists. Use for _editor
 * list views_ (admin tables, the navigation menu list, the documents-policies list) where the
 * intent is to show the latest editable view per document — including unpublished edits and
 * draft-only documents.
 *
 * Do NOT use for _pickers_ that build relations to a target document — those need
 * `publishedEntityVersionWhere()` so an unpublished or draft-only target cannot be selected.
 */
export function latestEditableEntityVersionWhere(): SQL | undefined {
	return or(
		eq(schema.entityStatus.type, "draft"),
		and(
			eq(schema.entityStatus.type, "published"),
			sql`
				NOT EXISTS (
					SELECT
						1
					FROM
						"entity_versions" AS "ev2"
						INNER JOIN "entity_status" AS "es2" ON "ev2"."status_id" = "es2"."id"
					WHERE
						"ev2"."entity_id" = ${schema.entityVersions.entityId}
						AND "es2"."type" = 'draft'
				)
			`,
		),
	);
}

export function publishedEntityVersionWhere(): SQL | undefined {
	return eq(schema.entityStatus.type, "published");
}

/**
 * Scope a query joining `entityVersions` to the default locale's row only. `entity_versions` now
 * allows one row per locale, so pickers and other admin-facing lookups that expect exactly one
 * canonical row per document need this — matching how `document_lifecycle` is pinned to the default
 * locale.
 */
export function defaultLocaleEntityVersionWhere(): SQL {
	return sql`
		${schema.entityVersions.localeId} = (
			SELECT ${schema.locales.id} FROM ${schema.locales} WHERE ${schema.locales.isDefault} = true
		)
	`;
}

/**
 * Locale filter for an aliased `entity_versions` row: the given locale, or the default when
 * omitted. Generic + `sql`-only (no `eq()`) because Drizzle's column types bake in the literal
 * table name, which an aliased column doesn't structurally match.
 */
export function localeMatch(localeColumn: unknown, localeId: string | undefined): SQL {
	return localeId != null
		? sql`${localeColumn} = ${localeId}`
		: sql`${localeColumn} = (SELECT ${schema.locales.id} FROM ${schema.locales} WHERE ${schema.locales.isDefault} = true)`;
}

/** Status filter for an aliased `entity_versions` row, by status type. */
export function statusMatch(statusColumn: unknown, type: "draft" | "published"): SQL {
	return sql`${statusColumn} = (SELECT ${schema.entityStatus.id} FROM ${schema.entityStatus} WHERE ${schema.entityStatus.type} = ${type})`;
}

/**
 * True when every `entityVersionIds` entry is a published version row. Use in server actions to
 * reject insertions that would link to a draft.
 */
export async function isPublishedEntityVersions(
	tx: Database | Transaction,
	entityVersionIds: ReadonlyArray<string>,
): Promise<boolean> {
	if (entityVersionIds.length === 0) {
		return true;
	}

	const rows = await tx
		.select({ id: schema.entityVersions.id })
		.from(schema.entityVersions)
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.where(
			and(
				eq(schema.entityStatus.type, "published"),
				inArray(schema.entityVersions.id, [...entityVersionIds]),
			),
		);

	return rows.length === entityVersionIds.length;
}

/** True when every document has at least one published version. */
export async function arePublishedEntityDocuments(
	tx: Database | Transaction,
	documentIds: ReadonlyArray<string>,
): Promise<boolean> {
	const uniqueDocumentIds = [...new Set(documentIds)];

	if (uniqueDocumentIds.length === 0) {
		return true;
	}

	const rows = await tx
		.selectDistinct({ id: schema.entityVersions.entityId })
		.from(schema.entityVersions)
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.where(
			and(
				eq(schema.entityStatus.type, "published"),
				inArray(schema.entityVersions.entityId, uniqueDocumentIds),
			),
		);

	return rows.length === uniqueDocumentIds.length;
}
