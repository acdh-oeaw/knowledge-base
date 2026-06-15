import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { PageItemCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/pages/_components/page-item-create-form";
import { imageGridOptions } from "@/config/assets.config";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getEntityRelationOptions, getResourceRelationOptions } from "@/lib/data/relations";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteCreatePageProps extends PageProps<"/[locale]/dashboard/website/pages/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteCreatePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Create page"),
	});

	return metadata;
}

export default async function DashboardWebsiteCreatePageItemPage(
	_props: Readonly<DashboardWebsiteCreatePageProps>,
): Promise<ReactNode> {
	const [{ items: initialAssets }, initialRelatedEntities, initialRelatedResources] =
		await Promise.all([
			getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "images" }),
			getEntityRelationOptions(),
			getResourceRelationOptions(),
		]);

	return (
		<PageItemCreateForm
			initialAssets={initialAssets}
			initialRelatedEntityItems={initialRelatedEntities.items}
			initialRelatedEntityTotal={initialRelatedEntities.total}
			initialRelatedResourceItems={initialRelatedResources.items}
			initialRelatedResourceTotal={initialRelatedResources.total}
		/>
	);
}
