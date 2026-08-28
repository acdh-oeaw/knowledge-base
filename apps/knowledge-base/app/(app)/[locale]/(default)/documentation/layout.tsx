import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { DocumentationNavigation } from "@/app/(app)/[locale]/(default)/documentation/_components/documentation-navigation";
import {
	documentationOverviewSlug,
	getPublishedDocumentationPages,
} from "@/app/(app)/[locale]/(default)/documentation/_lib/documentation-pages";

interface DocumentationLayoutProps extends LayoutProps<"/[locale]/documentation"> {}

export default async function DocumentationLayout(
	props: Readonly<DocumentationLayoutProps>,
): Promise<ReactNode> {
	const { children } = props;

	const t = await getExtracted();

	const pages = await getPublishedDocumentationPages();

	// The overview page is reached at `/documentation`, so it is listed as the fixed first entry
	// rather than alphabetically among the rest — and never twice.
	const rest = pages.filter((page) => page.slug !== documentationOverviewSlug);

	return (
		<div className="container flex-1 px-8 xs:px-16 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-12">
			<DocumentationNavigation
				label={t("Documentation")}
				overviewLabel={t("Overview")}
				pages={rest}
				toggleLabel={t("All pages")}
			/>

			{children}
		</div>
	);
}
