import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { NewsItemCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/news/_components/news-item-create-form";
import { imageGridOptions } from "@/config/assets.config";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getEntityRelationOptions, getResourceRelationOptions } from "@/lib/data/relations";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteCreateNewsPageProps extends PageProps<"/[locale]/dashboard/website/news/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteCreateNewsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Create news item"),
	});

	return metadata;
}

export default async function DashboardWebsiteCreateNewsItemPage(
	_props: Readonly<DashboardWebsiteCreateNewsPageProps>,
): Promise<ReactNode> {
	const [{ items: initialAssets }, initialRelatedEntities, initialRelatedResources] =
		await Promise.all([
			getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "images" }),
			getEntityRelationOptions(),
			getResourceRelationOptions(),
		]);

	return (
		<NewsItemCreateForm
			initialAssets={initialAssets}
			initialRelatedEntityItems={initialRelatedEntities.items}
			initialRelatedEntityTotal={initialRelatedEntities.total}
			initialRelatedResourceItems={initialRelatedResources.items}
			initialRelatedResourceTotal={initialRelatedResources.total}
		/>
	);
}
