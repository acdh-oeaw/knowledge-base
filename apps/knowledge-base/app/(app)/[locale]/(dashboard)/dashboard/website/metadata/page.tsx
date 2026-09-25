import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { SiteMetadataForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/metadata/_components/site-metadata-form";
import { imageGridOptions } from "@/config/assets.config";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getLocales } from "@/lib/data/locales";
import {
	selectedImageColumns,
	selectedImageWith,
	toSelectedImage,
} from "@/lib/data/selected-image";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteMetadataPageProps extends PageProps<"/[locale]/dashboard/website/metadata"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteMetadataPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Metadata"),
	});

	return metadata;
}

export default async function DashboardWebsiteMetadataPage(
	props: Readonly<DashboardWebsiteMetadataPageProps>,
): Promise<ReactNode> {
	const { searchParams: searchParamsPromise } = props;

	const t = await getExtracted();

	const { locale: localeParam } = await searchParamsPromise;

	const locales = await getLocales();
	const requestedLocale = locales.find((locale) => locale.code === localeParam);
	const selectedLocale =
		requestedLocale ?? locales.find((locale) => locale.isDefault) ?? locales[0];

	if (selectedLocale == null) {
		notFound();
	}

	const [{ items: initialAssets }, siteMetadataRow] = await Promise.all([
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "images" }),
		db.query.siteMetadataTranslations.findFirst({
			where: { localeId: selectedLocale.id },
			columns: {
				title: true,
				description: true,
				ogTitle: true,
				ogDescription: true,
			},
			with: {
				ogImage: {
					columns: selectedImageColumns,
					with: selectedImageWith,
				},
			},
		}),
	]);

	const ogImage =
		siteMetadataRow?.ogImage != null
			? toSelectedImage(siteMetadataRow.ogImage, imageGridOptions)
			: null;

	const siteMetadata =
		siteMetadataRow != null
			? {
					title: siteMetadataRow.title,
					description: siteMetadataRow.description,
					ogTitle: siteMetadataRow.ogTitle,
					ogDescription: siteMetadataRow.ogDescription,
					ogImage,
				}
			: null;

	return (
		<div className="flex flex-col gap-y-6">
			<Header>
				<HeaderContent>
					<HeaderTitle>{t("Website metadata")}</HeaderTitle>
					<HeaderDescription>{t("Manage website metadata.")}</HeaderDescription>
				</HeaderContent>
			</Header>

			<div className="p-(--layout-padding)">
				<SiteMetadataForm
					initialAssets={initialAssets}
					localeId={selectedLocale.id}
					locales={locales}
					selectedLocaleCode={selectedLocale.code}
					siteMetadata={siteMetadata}
				/>
			</div>
		</div>
	);
}
