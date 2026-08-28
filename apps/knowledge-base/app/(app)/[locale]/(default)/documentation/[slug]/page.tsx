import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DocumentationArticle } from "@/app/(app)/[locale]/(default)/documentation/_components/documentation-article";
import {
	documentationOverviewSlug,
	getPublishedDocumentationPage,
} from "@/app/(app)/[locale]/(default)/documentation/_lib/documentation-pages";
import { getResolvedEntityContentBlocks } from "@/lib/content-blocks-service";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

async function getDocumentationPage(slug: string) {
	const page = await getPublishedDocumentationPage(slug);

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
	const { locale, slug } = await props.params;

	// The overview page is rendered by the index, which is the address the navigation and every
	// other page link to. Serving it here as well would put the same content at two urls.
	if (slug === documentationOverviewSlug) {
		redirect({ href: "/documentation", locale: locale as IntlLocale });
	}

	const page = await getDocumentationPage(slug);
	const contentBlocks = await getResolvedEntityContentBlocks(page.id, "content");

	return <DocumentationArticle contentBlocks={contentBlocks} title={page.title} />;
}
