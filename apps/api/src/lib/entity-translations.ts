import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import type { Database, Transaction } from "@/middlewares/db";
import { and, eq } from "@/services/db/sql";

export interface EntityTranslation {
	/**
	 * BCP 47-style locale code (e.g. "de" or "de-AT"), matching the `?locale=` query param this api
	 * accepts elsewhere — a consumer can feed it straight back in to request this same entity in that
	 * locale.
	 */
	locale: string;
	slug: string;
}

/**
 * Every locale a document currently has a published version in, each with that locale's own slug —
 * for a language switcher on a detail page to link to the same entity in another locale. Entity-
 * type agnostic (works from `entities.id`/`entityVersions` alone), unlike the rest of this api's
 * per-route services, which stay self-contained; this one lives in `lib` because every entity type
 * needs the identical lookup.
 *
 * Includes the locale the caller is already viewing, not just the "other" ones — a switcher needs
 * every language's slug to render its full list of links (including the current, active one)
 * without a special case.
 */
export async function getEntityTranslations(
	db: Database | Transaction,
	documentId: string,
): Promise<Array<EntityTranslation>> {
	const status = await db.query.entityStatus.findFirst({
		where: { type: "published" },
		columns: { id: true },
	});
	assert(status, "No published entity status in database.");

	const rows = await db
		.select({
			slug: schema.slugs.value,
			languageCode: schema.locales.languageCode,
			regionCode: schema.locales.regionCode,
		})
		.from(schema.entityVersions)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.innerJoin(schema.locales, eq(schema.locales.id, schema.entityVersions.localeId))
		.where(
			and(
				eq(schema.entityVersions.entityId, documentId),
				eq(schema.entityVersions.statusId, status.id),
			),
		);

	return rows.map((row) => {
		return {
			locale: row.regionCode != null ? `${row.languageCode}-${row.regionCode}` : row.languageCode,
			slug: row.slug,
		};
	});
}
