import { collectHeadings } from "@dariah-eric/ui/rich-text";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { Main } from "@/app/(app)/[locale]/(default)/_components/main";
import { DocumentationTableOfContents } from "@/app/(app)/[locale]/(default)/documentation/_components/documentation-table-of-contents";

/**
 * The heading levels the outline lists. The editor offers `h2`–`h4`; an `h4` is a detail inside a
 * subsection, and listing those makes the rail longer than the page it summarises.
 */
const outlineLevels = new Set([2, 3]);

interface DocumentationArticleProps {
	contentBlocks: Array<ContentBlock>;
	title: string;
}

/** A documentation page: its content beside an outline of its own headings. */
export async function DocumentationArticle(
	props: Readonly<DocumentationArticleProps>,
): Promise<ReactNode> {
	const { contentBlocks, title } = props;

	const t = await getExtracted();

	// The same walk `ContentBlocksView` runs to anchor the headings, over the same blocks, so an
	// entry and the heading it points at always agree on the id.
	const headings = collectHeadings(contentBlocks).filter((heading) =>
		outlineLevels.has(heading.level),
	);

	return (
		<Main className="grid gap-x-12 py-8 lg:py-12 xl:grid-cols-[minmax(0,1fr)_14rem]">
			<article className="flex flex-col gap-y-8 max-inline-(--breakpoint-md)">
				<h1 className="text-4xl font-extrabold tracking-tight text-text-strong">{title}</h1>
				{contentBlocks.length > 0 ? <ContentBlocksView contentBlocks={contentBlocks} /> : null}
			</article>

			<DocumentationTableOfContents
				headings={headings}
				label={t("Table of contents")}
				title={t("On this page")}
			/>
		</Main>
	);
}
