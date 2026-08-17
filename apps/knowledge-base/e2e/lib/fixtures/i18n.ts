import { keyBy } from "@acdh-oeaw/lib";
import type { Page } from "@playwright/test";
import { createFormatter, createTranslator } from "next-intl";

import { type IntlLocale, defaultLocale, getIntlLanguage } from "@/lib/i18n/locales";
import type metadataMessages from "@/messages/metadata/en/index.json";

export interface I18n {
	t: ReturnType<typeof createTranslator<IntlMessages>>;
	format: ReturnType<typeof createFormatter>;
	messages: IntlMessages;
}

export async function createI18n(_page: Page, locale = defaultLocale): Promise<I18n> {
	const messages = await getIntlMessages(locale);

	return {
		t: createTranslator({ locale, messages }),
		format: createFormatter({ locale }),
		messages,
	};
}

export type WithI18n<T> = T & { i18n: I18n };

/**
 * Copied from `@/lib/i18n/messages.ts` because `playwright` needs import attributes for json
 * imports.
 */

type Metadata = typeof metadataMessages;
type SocialMedia = Metadata["social"];
type SocialMediaMetadata = {
	[Kind in SocialMedia[number]["kind"]]: Extract<SocialMedia[number], { kind: Kind }>;
};

export interface IntlMessages {
	metadata: Omit<Metadata, "social"> & { social: SocialMediaMetadata };
}

async function getIntlMessages(locale: IntlLocale): Promise<IntlMessages> {
	const language = getIntlLanguage(locale);

	const [
		// { default: extracted },
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		{ default: metadata },
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		{ default: ui },
	] = await Promise.all([
		// import(`@/messages/${language}.json`, { with: { type: "json" } }),
		import(`@/messages/metadata/${language}/index.json`, { with: { type: "json" } }),
		import(`@dariah-eric/ui/i18n/${language}`, { with: { type: "json" } }),
	]);

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const social = keyBy(metadata.social as SocialMedia, (item) => item.kind);

	switch (language) {
		// case "de": {
		// 	await import("@valibot/i18n/de");
		// 	break;
		// }

		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		case "en": {
			/** Default messages. */
			break;
		}
	}

	const messages = {
		// ...extracted,
		...ui,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		metadata: {
			...metadata,
			social,
		},
	} as IntlMessages;

	return messages;
}
