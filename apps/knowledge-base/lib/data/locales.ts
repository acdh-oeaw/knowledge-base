import { assert } from "@acdh-oeaw/lib";

import { type Transaction, db } from "@/lib/db";

export interface LocaleOption {
	id: string;
	/** BCP 47-style code, e.g. "en-GB" or "de" — used in URLs instead of the opaque db id. */
	code: string;
	name: string;
	isDefault: boolean;
}

function formatLocaleCode(languageCode: string, regionCode: string | null): string {
	return regionCode == null ? languageCode : `${languageCode}-${regionCode.toUpperCase()}`;
}

/**
 * The `?locale=…` query a redirect after saving needs to land back on the locale version just
 * edited. Empty for the default locale, which is what the pages show without one.
 */
export async function getLocaleSearch(tx: Transaction, localeId: string): Promise<string> {
	const locale = await tx.query.locales.findFirst({
		where: { id: localeId },
		columns: { languageCode: true, regionCode: true, isDefault: true },
	});
	assert(locale, `Locale "${localeId}" not found.`);

	if (locale.isDefault) {
		return "";
	}

	return `?locale=${encodeURIComponent(formatLocaleCode(locale.languageCode, locale.regionCode))}`;
}

export async function getLocales(): Promise<Array<LocaleOption>> {
	const rows = await db.query.locales.findMany({
		columns: { id: true, languageCode: true, regionCode: true, name: true, isDefault: true },
		orderBy: { isDefault: "desc" },
	});

	return rows.map((row) => {
		return {
			id: row.id,
			code: formatLocaleCode(row.languageCode, row.regionCode),
			name: row.name,
			isDefault: row.isDefault,
		};
	});
}

export async function getDefaultLocale(): Promise<LocaleOption> {
	const locales = await getLocales();
	const defaultLocale = locales.find((locale) => locale.isDefault);

	if (defaultLocale == null) {
		throw new Error("Default locale not found in database.");
	}

	return defaultLocale;
}
