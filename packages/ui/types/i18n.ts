import type { IntlFormats, IntlLocale, IntlMessages } from "../config/i18n.config";

declare module "next-intl" {
	interface AppConfig {
		Formats: IntlFormats;
		Locale: IntlLocale;
		Messages: IntlMessages;
	}
}
