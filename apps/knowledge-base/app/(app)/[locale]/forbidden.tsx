import type { Metadata } from "next";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ForbiddenState } from "@/app/_components/forbidden-state";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = {
		title: t("Access forbidden"),
		/**
		 * Automatically set by next.js.
		 *
		 * @see {@link https://nextjs.org/docs/app/api-reference/functions/forbidden}
		 */
		// robots: {
		// 	index: false,
		// },
	};

	return metadata;
}

export default function ForbiddenPage(): ReactNode {
	const t = useExtracted();

	return (
		<ForbiddenState
			codeLabel={t("Error 403")}
			description={t(
				"You don't have permission to access this page. If you believe this is a mistake, please contact your administrator.",
			)}
			homeHref="/"
			homeLabel={t("Back to home")}
			logoLabel={t("Home")}
			title={t("Access forbidden")}
		/>
	);
}
