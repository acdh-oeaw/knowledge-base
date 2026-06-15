import { NextIntlClientProvider } from "next-intl";
import { Fragment, type ReactNode } from "react";
import { LocalizedStringProvider } from "react-aria-components/i18n";

import { ClientProviders } from "@/app/_components/client-providers";
import { AnalyticsProvider } from "@/lib/analytics/analytics-provider";
import { ColorSchemeProvider } from "@/lib/color-scheme/color-scheme-provider";
import type { IntlLocale } from "@/lib/i18n/locales";
import type { IntlMessages } from "@/lib/i18n/messages";

interface ProvidersProps {
	children: ReactNode;
	locale: IntlLocale;
	messages?: Partial<IntlMessages>;
	withClientProviders?: boolean;
}

export function Providers(props: Readonly<ProvidersProps>): ReactNode {
	const { children, locale, messages, withClientProviders = true } = props;

	const content = withClientProviders ? (
		<ClientProviders locale={locale}>{children}</ClientProviders>
	) : (
		children
	);

	return (
		<Fragment>
			{/* @see {@link https://react-spectrum.adobe.com/react-aria/ssr.html#advanced-optimization} */}
			<LocalizedStringProvider locale={locale} />
			<NextIntlClientProvider locale={locale} messages={messages}>
				{content}
				<AnalyticsProvider />
			</NextIntlClientProvider>
			<ColorSchemeProvider />
		</Fragment>
	);
}
