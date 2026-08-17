import { keyBy } from "@acdh-oeaw/lib";

import { type IntlLocale, getIntlLanguage } from "@/lib/i18n/locales";
import type metadataMessages from "@/messages/metadata/en/index.json";

type Metadata = typeof metadataMessages;
type SocialMedia = Metadata["social"];
type SocialMediaMetadata = {
	[Kind in SocialMedia[number]["kind"]]: Extract<SocialMedia[number], { kind: Kind }>;
};

export interface IntlMessages {
	metadata: Omit<Metadata, "social"> & { social: SocialMediaMetadata };
}

export async function getIntlMessages(locale: IntlLocale): Promise<IntlMessages> {
	const language = getIntlLanguage(locale);

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const [{ default: extracted }, { default: metadata }, { default: ui }] = await Promise.all([
		import(`@/messages/${language}.po`),
		import(`@/messages/metadata/${language}/index.json`) as Promise<{ default: Metadata }>,
		import(`@dariah-eric/ui/i18n/${language}`),
	]);

	const social = keyBy(metadata.social, (item) => item.kind);

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
		...ui,
		...extracted,
		metadata: {
			...metadata,
			social,
		},
	} as IntlMessages;

	return messages;
}
