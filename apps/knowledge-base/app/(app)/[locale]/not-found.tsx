import type { Metadata } from "next";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { NotFoundState } from "@/app/_components/not-found-state";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = {
		title: t("Page not found"),
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

export default function NotFoundPage(): ReactNode {
	const t = useExtracted();

	return (
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
	);
}
