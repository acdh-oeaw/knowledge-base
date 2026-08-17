import * as schema from "@dariah-eric/database/schema";

import { type SQL, sql } from "@/lib/db/sql";

/**
 * Matches navigation items belonging to the same locale as `localeId` (or, when `localeId` is
 * `null`, items belonging to the same locale as a `NULL` row). Navigation items predate per-locale
 * support, so existing rows have `locale_id = NULL` — treated as the default locale — while items
 * created after this feature always store a concrete locale id, including for the default locale.
 * Matching either shape therefore requires checking both against the literal value and against
 * `NULL` whenever that value happens to be the default locale.
 */
export function navigationItemLocaleWhere(localeId: string | null): SQL {
  if (localeId == null) {
    return sql`(
			${schema.navigationItems.localeId} IS NULL
			OR ${schema.navigationItems.localeId} = (
				SELECT ${schema.locales.id} FROM ${schema.locales} WHERE ${schema.locales.isDefault} = true
			)
		)`;
  }

  return sql`(
		${schema.navigationItems.localeId} = ${localeId}
		OR (
			${schema.navigationItems.localeId} IS NULL
			AND ${localeId} = (
				SELECT ${schema.locales.id} FROM ${schema.locales} WHERE ${schema.locales.isDefault} = true
			)
		)
	)`;
}
