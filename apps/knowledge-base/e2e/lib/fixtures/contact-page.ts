/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { type Locator, type Page, expect } from "@playwright/test";

import type { I18n } from "@/e2e/lib/fixtures/i18n";
import { type IntlLocale, defaultLocale } from "@/lib/i18n/locales";
import { localePrefix } from "@/lib/i18n/routing";
// import { getPathname } from "@/lib/i18n/navigation";

/** @see {@link https://github.com/microsoft/playwright/issues/35162} */
function getPathname({ href, locale }: { href: { pathname: string }; locale: IntlLocale }): string {
	return localePrefix.prefixes[locale] + href.pathname;
}

export class ContactPage {
	readonly page: Page;
	readonly locale: IntlLocale;
	readonly i18n: I18n;
	readonly url: string;
	readonly mainContent: Locator;
	readonly title: Locator;
	readonly skipLink: Locator;

	readonly form: {
		email: Locator;
		message: Locator;
		name: Locator;
		subject: Locator;
		submit: Locator;
	};

	constructor(page: Page, locale = defaultLocale, i18n: I18n) {
		this.page = page;
		this.locale = locale;
		this.i18n = i18n;
		this.url = getPathname({ href: { pathname: "/contact" }, locale });
		this.mainContent = page.getByRole("main");
		this.title = page.getByRole("heading", { level: 1 });
		this.skipLink = page.getByRole("link", { name: "Skip to main content" });

		this.form = {
			email: page.getByRole("textbox", { name: "Email" }),
			message: page.getByRole("textbox", { name: "Message" }),
			name: page.getByRole("textbox", { name: "Name" }),
			subject: page.getByRole("textbox", { name: "Subject" }),
			submit: page.getByRole("button", { name: "Send" }),
		};
	}

	goto() {
		return this.page.goto(this.url);
	}

	/** @see {@link https://github.com/microsoft/playwright/issues/36395#issuecomment-2995675184} */
	fillPolling = async (locator: Locator, value: string) => {
		await expect
			.poll(async () => {
				await locator.clear();
				await locator.fill(value);
				return await locator.inputValue();
			})
			.toStrictEqual(value);
	};
}
