import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { Main } from "@/app/(app)/[locale]/(default)/_components/main";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

async function getDocumentationPage(slug: string) {
	const page = await db.query.documentationPages.findFirst({
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

interface DocumentationPageProps extends PageProps<"/[locale]/documentation/[slug]"> {}

export async function generateMetadata(
	props: Readonly<DocumentationPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const { slug } = await props.params;

	const page = await getDocumentationPage(slug);

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: page.title,
	});

	return metadata;
}

export default async function DocumentationPage(
	props: Readonly<DocumentationPageProps>,
): Promise<ReactNode> {
	const { slug } = await props.params;

	const page = await getDocumentationPage(slug);
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
