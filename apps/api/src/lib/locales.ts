import * as schema from "@acdh-knowledge-base/database/schema";

import type { Database, Transaction } from "@/middlewares/db";
import { and, eq, isNull } from "@/services/db/sql";

/**
 * Resolve a BCP 47-style locale code (e.g. "de" or "de-AT") from a `?locale=` query param to a
 * `locales.id`. Returns `null` for a missing/empty/unrecognized code, in which case callers should
 * fall back to the default locale.
 */
export async function resolveLocaleId(
	db: Database | Transaction,
	code: string | undefined,
): Promise<string | null> {
	if (code == null || code.trim() === "") {
		return null;
	}

	const [languageCode, regionCode] = code.split("-");

	if (languageCode == null || languageCode === "") {
		return null;
	}

	const [locale] = await db
		.select({ id: schema.locales.id })
		.from(schema.locales)
		.where(
			and(
				eq(schema.locales.languageCode, languageCode.toLowerCase()),
				regionCode != null && regionCode !== ""
					? eq(schema.locales.regionCode, regionCode.toUpperCase())
					: isNull(schema.locales.regionCode),
			),
		)
		.limit(1);

	return locale?.id ?? null;
}

export async function getDefaultLocaleId(db: Database | Transaction): Promise<string> {
	const [locale] = await db
		.select({ id: schema.locales.id })
		.from(schema.locales)
		.where(eq(schema.locales.isDefault, true))
		.limit(1);

	if (locale == null) {
		throw new Error("No default locale configured in database.");
	}

	return locale.id;
}

export interface LocaleContext {
	/** The locale to prefer — the requested locale, or the default locale when none was requested. */
	localeId: string;
	/** The default locale — the fallback for documents with no version in `localeId`. */
	defaultLocaleId: string;
}

/**
 * Resolve the locale to prefer for a request, plus the default locale to fall back to per-document
 * when a document has no version in the preferred locale. When `requestedLocaleId` is omitted (or
 * already the default), `localeId` and `defaultLocaleId` are the same id — callers can join against
 * both unconditionally without special-casing "no locale requested".
 */
export async function resolveLocaleContext(
	db: Database | Transaction,
	requestedLocaleId: string | undefined,
): Promise<LocaleContext> {
	const defaultLocaleId = await getDefaultLocaleId(db);
	return { localeId: requestedLocaleId ?? defaultLocaleId, defaultLocaleId };
}
