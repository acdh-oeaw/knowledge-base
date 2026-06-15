import type { Metadata } from "next";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { DocumentBody } from "@/app/_components/document-body";
import { HtmlDocument } from "@/app/_components/html-document";
import { NotFoundState } from "@/app/_components/not-found-state";
import { Providers } from "@/app/_components/providers";
import { defaultLocale } from "@/lib/i18n/locales";
import { getMetadata } from "@/lib/i18n/metadata";

export { viewport } from "@/app/_lib/viewport.config";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const meta = await getMetadata();

	const metadata: Metadata = {
		title: [t("Page not found"), meta.title].join(" | "),
		/**
		 * Automatically set by next.js.
		 *
		 * @see {@link https://nextjs.org/docs/app/api-reference/functions/not-found}
		 */
		// robots: {
		// 	index: false,
		// },
	};

	return metadata;
}

export default function GlobalNotFoundPage(): ReactNode {
	const locale = defaultLocale;
	const t = useExtracted();

	return (
		<HtmlDocument locale={locale}>
			<DocumentBody>
				<Providers locale={locale} withClientProviders={false}>
					<NotFoundState
						codeLabel={t("Error 404")}
						description={t(
							"The page you requested could not be found. It may have been moved, renamed, or never existed in this part of the knowledge base.",
						)}
						homeHref="/"
						homeLabel={t("Back to home")}
						logoLabel={t("Home")}
						title={t("Page not found")}
					/>
				</Providers>
			</DocumentBody>
		</HtmlDocument>
	);
}
