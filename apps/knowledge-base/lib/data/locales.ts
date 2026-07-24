import { db } from "@/lib/db";

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
