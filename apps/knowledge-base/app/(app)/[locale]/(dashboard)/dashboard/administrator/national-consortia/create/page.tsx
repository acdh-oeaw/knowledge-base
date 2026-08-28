import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { NationalConsortiumCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/national-consortia/_components/national-consortium-create-form";
import { imageGridOptions } from "@/config/assets.config";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getDefaultLocale } from "@/lib/data/locales";
import { getEntityRelationOptions, getResourceRelationOptions } from "@/lib/data/relations";
import { getSocialMediaOptions } from "@/lib/data/social-media";
import { createMetadata } from "@/lib/server/create-metadata";

export async function generateMetadata(
	_props: unknown,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Create national consortium"),
	});

	return metadata;
}

export default async function DashboardAdministratorCreateNationalConsortiumPage(): Promise<ReactNode> {
	const [
		{ items: initialAssets },
		initialRelatedEntities,
		initialRelatedResources,
		initialSocialMedia,
		defaultLocale,
	] = await Promise.all([
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "logos" }),
		getEntityRelationOptions(),
		getResourceRelationOptions(),
		getSocialMediaOptions(),
		getDefaultLocale(),
	]);

	return (
		<NationalConsortiumCreateForm
			defaultLocaleName={defaultLocale.name}
			initialAssets={initialAssets}
			initialRelatedEntityItems={initialRelatedEntities.items}
			initialRelatedEntityTotal={initialRelatedEntities.total}
			initialRelatedResourceItems={initialRelatedResources.items}
			initialRelatedResourceTotal={initialRelatedResources.total}
			initialSocialMediaItems={initialSocialMedia.items}
			initialSocialMediaTotal={initialSocialMedia.total}
		/>
	);
}
