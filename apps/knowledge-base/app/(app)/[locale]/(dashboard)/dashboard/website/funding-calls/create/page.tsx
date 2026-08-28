import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { FundingCallCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_components/funding-call-create-form";
import { imageGridOptions } from "@/config/assets.config";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getEntityRelationOptions, getResourceRelationOptions } from "@/lib/data/relations";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteCreateFundingCallPageProps extends PageProps<"/[locale]/dashboard/website/funding-calls/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteCreateFundingCallPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Create funding call"),
	});

	return metadata;
}

export default async function DashboardWebsiteCreateFundingCallPage(
	_props: Readonly<DashboardWebsiteCreateFundingCallPageProps>,
): Promise<ReactNode> {
	const [{ items: initialAssets }, initialRelatedEntities, initialRelatedResources] =
		await Promise.all([
			getMediaLibraryAssets({
				imageUrlOptions: imageGridOptions,
				prefix: "images",
			}),
			getEntityRelationOptions(),
			getResourceRelationOptions(),
		]);

	return (
		<FundingCallCreateForm
			initialAssets={initialAssets}
			initialRelatedEntityItems={initialRelatedEntities.items}
			initialRelatedEntityTotal={initialRelatedEntities.total}
			initialRelatedResourceItems={initialRelatedResources.items}
			initialRelatedResourceTotal={initialRelatedResources.total}
		/>
	);
}
