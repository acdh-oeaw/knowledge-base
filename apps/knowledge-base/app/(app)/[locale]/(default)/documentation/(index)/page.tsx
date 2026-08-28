import { Link } from "@dariah-eric/ui/link";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { Main } from "@/app/(app)/[locale]/(default)/_components/main";
import { DocumentationArticle } from "@/app/(app)/[locale]/(default)/documentation/_components/documentation-article";
import {
	documentationOverviewSlug,
	getPublishedDocumentationPage,
	getPublishedDocumentationPages,
} from "@/app/(app)/[locale]/(default)/documentation/_lib/documentation-pages";
import { getResolvedEntityContentBlocks } from "@/lib/content-blocks-service";
import { createMetadata } from "@/lib/server/create-metadata";

interface DocumentationPageProps extends PageProps<"/[locale]/documentation"> {}

export async function generateMetadata(
	_props: Readonly<DocumentationPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const overview = await getPublishedDocumentationPage(documentationOverviewSlug);

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: overview?.title ?? t("Documentation"),
	});

	return metadata;
}

export default async function DocumentationPage(
	_props: Readonly<DocumentationPageProps>,
): Promise<ReactNode> {
	const overview = await getPublishedDocumentationPage(documentationOverviewSlug);

	if (overview != null) {
		const contentBlocks = await getResolvedEntityContentBlocks(overview.id, "content");

		return <DocumentationArticle contentBlocks={contentBlocks} title={overview.title} />;
	}

	return <DocumentationIndex />;
}

/**
 * What `/documentation` shows until an editor writes the overview page.
 *
 * Every page is listed rather than only named in the sidebar: on a narrow screen the sidebar is
 * collapsed, and this is then the only way into the section.
 */
async function DocumentationIndex(): Promise<ReactNode> {
	const t = await getExtracted();

	const pages = await getPublishedDocumentationPages();

	return (
		<Main className="flex flex-col gap-y-10 py-8 lg:py-12">
			<div className="flex flex-col gap-y-4 max-inline-(--breakpoint-md)">
				<h1 className="text-4xl font-extrabold tracking-tight text-text-strong">
					{t("Documentation")}
				</h1>
				<p className="text-lg text-text-weak">
					{t("Guides and reference material for working with the DARIAH Knowledge Base.")}
				</p>
			</div>

			{pages.length > 0 ? (
				<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{pages.map((page) => (
						<li key={page.id}>
							<Link
								className="flex flex-col rounded-lg border border-stroke-weak p-5 font-semibold text-text-strong transition duration-200 block-full hover:border-stroke-strong"
								href={`/documentation/${page.slug}`}
							>
								{page.title}
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p className="text-text-weak">{t("No documentation pages have been published yet.")}</p>
			)}
		</Main>
	);
}
