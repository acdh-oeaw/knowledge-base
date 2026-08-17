"use client";

import { type UiContextValue, UiProvider } from "@dariah-eric/ui/ui-provider";
import type { ReactNode } from "react";
import {
	I18nProvider as AriaI18nProvider,
	RouterProvider as AriaRouterProvider,
} from "react-aria-components";

import type { IntlLocale } from "@/lib/i18n/locales";
import { LocaleLink, useRouter } from "@/lib/navigation/navigation";

const ui: UiContextValue = {
	LinkComponent: LocaleLink,
};

interface ClientProvidersProps {
	children: ReactNode;
	locale: IntlLocale;
}

function AriaRouterIntegration(props: Readonly<{ children: ReactNode }>): ReactNode {
	const router = useRouter();
	return <AriaRouterProvider navigate={router.push}>{props.children}</AriaRouterProvider>;
}

export function ClientProviders(props: Readonly<ClientProvidersProps>): ReactNode {
	const { children, locale } = props;

	return (
		<AriaI18nProvider locale={locale}>
			<AriaRouterIntegration>
				<UiProvider value={ui}>{children}</UiProvider>
			</AriaRouterIntegration>
		</AriaI18nProvider>
	);
}
