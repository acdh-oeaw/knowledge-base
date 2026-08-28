import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { FeaturedItemsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/featured/_components/featured-items-form";
import { getAnnouncementOptions, getAnnouncementOptionsByIds } from "@/lib/data/announcements";
import { getEventOptions, getEventOptionsByIds } from "@/lib/data/events";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteFeaturedPageProps extends PageProps<"/[locale]/dashboard/website/featured"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteFeaturedPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Featured items"),
	});

	return metadata;
}

export default async function DashboardWebsiteFeaturedPage(
	_props: Readonly<DashboardWebsiteFeaturedPageProps>,
): Promise<ReactNode> {
	const t = await getExtracted();

	const siteMetadataRow = await db.query.siteMetadata.findFirst({
		columns: {
			featuredItemIds: true,
		},
	});

	const featuredNewsIds = siteMetadataRow?.featuredItemIds?.news ?? [];
	const featuredEventIds = siteMetadataRow?.featuredItemIds?.events ?? [];

	const [
		initialFeaturedNewsOptions,
		selectedFeaturedNews,
		initialFeaturedEventOptions,
		selectedFeaturedEvents,
	] = await Promise.all([
		getAnnouncementOptions(),
		getAnnouncementOptionsByIds(featuredNewsIds),
		getEventOptions(),
		getEventOptionsByIds(featuredEventIds),
	]);

	return (
		<div className="flex flex-col gap-y-6">
			<Header>
				<HeaderContent>
					<HeaderTitle>{t("Featured items")}</HeaderTitle>
					<HeaderDescription>
						{t("Manage the news items featured on the landing page.")}
					</HeaderDescription>
				</HeaderContent>
			</Header>

			<div className="p-(--layout-padding)">
				<FeaturedItemsForm
					featuredEventIds={featuredEventIds}
					featuredNewsIds={featuredNewsIds}
					initialFeaturedEventOptions={initialFeaturedEventOptions}
					initialFeaturedNewsOptions={initialFeaturedNewsOptions}
					selectedFeaturedEvents={selectedFeaturedEvents}
					selectedFeaturedNews={selectedFeaturedNews}
				/>
			</div>
		</div>
	);
}
