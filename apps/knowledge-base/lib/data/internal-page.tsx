import type * as schema from "@acdh-knowledge-base/database/schema";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { Main } from "@/app/(app)/[locale]/(default)/_components/main";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { db } from "@/lib/db";

export async function getPublishedInternalPage(
	slug: string,
): Promise<Pick<schema.InternalPage, "id" | "title">> {
	const page = await db.query.internalPages.findFirst({
		where: {
			entityVersion: {
				entity: {
					slug,
				},
				status: {
					type: "published",
				},
			},
		},
		columns: {
			id: true,
			title: true,
		},
	});

	if (page == null) {
		notFound();
	}

	return page;
}

interface InternalPageViewProps {
	slug: string;
}

export async function InternalPageView(props: Readonly<InternalPageViewProps>): Promise<ReactNode> {
	const { slug } = props;

	const page = await getPublishedInternalPage(slug);
	const contentBlocks = await getEntityContentBlocks(page.id, "content");

	return (
		<Main className="container flex-1 px-8 py-12 xs:px-16">
			<section className="flex max-inline-(--breakpoint-md) flex-col gap-y-8">
				<h1 className="text-5xl font-extrabold tracking-tight text-text-strong">{page.title}</h1>
				{contentBlocks.length > 0 ? <ContentBlocksView contentBlocks={contentBlocks} /> : null}
			</section>
		</Main>
	);
}
