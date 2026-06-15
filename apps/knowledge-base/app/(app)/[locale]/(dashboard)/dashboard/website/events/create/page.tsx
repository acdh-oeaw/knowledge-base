import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { EventCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_components/event-create-form";
import { imageGridOptions } from "@/config/assets.config";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getEntityRelationOptions, getResourceRelationOptions } from "@/lib/data/relations";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteCreateEventPageProps extends PageProps<"/[locale]/dashboard/website/events/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteCreateEventPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Create event"),
	});

	return metadata;
}

export default async function DashboardWebsiteCreateEventPage(
	_props: Readonly<DashboardWebsiteCreateEventPageProps>,
): Promise<ReactNode> {
	const [{ items: initialAssets }, initialRelatedEntities, initialRelatedResources] =
		await Promise.all([
			getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "images" }),
			getEntityRelationOptions(),
			getResourceRelationOptions(),
		]);

	return (
		<EventCreateForm
			initialAssets={initialAssets}
			initialRelatedEntityItems={initialRelatedEntities.items}
			initialRelatedEntityTotal={initialRelatedEntities.total}
			initialRelatedResourceItems={initialRelatedResources.items}
			initialRelatedResourceTotal={initialRelatedResources.total}
		/>
	);
}
