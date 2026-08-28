import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { NewsItemDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/news/_components/news-details";
import { discardNewsItemDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/news/_lib/discard-news-item-draft.action";
import { publishNewsItemAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/news/_lib/publish-news-item.action";
import { imageGridOptions } from "@/config/assets.config";
import { getResolvedEntityContentBlocks } from "@/lib/content-blocks-service";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import {
	getEntityRelationOptionsByIds,
	getEntityRelations,
	getResourceRelationOptionsByIds,
} from "@/lib/data/relations";
import {
	selectedImageColumns,
	selectedImageWith,
	toSelectedImage,
} from "@/lib/data/selected-image";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteNewsItemDetailsPageProps extends PageProps<"/[locale]/dashboard/website/news/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteNewsItemDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - News Item details"),
	});

	return metadata;
}

export default async function DashboardWebsiteNewsItemDetailsPage(
	props: Readonly<DashboardWebsiteNewsItemDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();

	const anyVersion = await db.query.news.findFirst({
		where: { entityVersion: { slug: { value: slug } } },
		columns: {},
		with: {
			entityVersion: {
				columns: {},
				with: { entity: { columns: { id: true } } },
			},
		},
	});

	if (anyVersion == null) {
		notFound();
	}

	const doc = { id: anyVersion.entityVersion.entity.id };

	const { locale: localeParam, version } = await searchParamsPromise;

	const locales = await getLocales();
	const requestedLocale = locales.find((locale) => locale.code === localeParam);
	const selectedLocale =
		requestedLocale ?? locales.find((locale) => locale.isDefault) ?? locales[0];

	if (selectedLocale == null) {
		notFound();
	}

	const localizedVersion = await resolveLocalizedDetailVersion(
		doc.id,
		version,
		locales,
		selectedLocale.id,
	);

	if (localizedVersion == null) {
		return (
			<Fragment>
				<div className="flex items-center justify-between">
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocale.code} />
				</div>
				<p className="text-sm text-muted-fg italic">
					{t("This document has no content in the selected locale yet.")}
				</p>
			</Fragment>
		);
	}
	const { hasDraftChanges, isLocaleFallback, publishedId, selectedVersion, versionId } =
		localizedVersion;

	const newsItem = await db.query.news.findFirst({
		where: { id: versionId },
		columns: {
			imageCaption: true,
			imageCaptionMode: true,
			id: true,
			publicationDate: true,
			title: true,
			summary: true,
		},
		with: {
			entityVersion: {
				columns: { id: true },
				with: {
					entity: {
						columns: {
							id: true,
						},
					},
					slug: {
						columns: {
							value: true,
						},
					},
					status: {
						columns: {
							id: true,
							type: true,
						},
					},
				},
			},
			image: {
				columns: selectedImageColumns,
				with: selectedImageWith,
			},
		},
	});

	if (newsItem == null) {
		notFound();
	}

	assert(
		newsItem.entityVersion.slug,
		`Slug missing for entity version "${newsItem.entityVersion.id}".`,
	);
	const entityVersionSlug = newsItem.entityVersion.slug;

	const image = toSelectedImage(newsItem.image, imageGridOptions);

	const contentBlocks = await getResolvedEntityContentBlocks(newsItem.id, "content");

	const { relatedEntityIds, relatedResourceIds } = await getEntityRelations(doc.id);

	const [selectedRelatedEntities, selectedRelatedResources] = await Promise.all([
		getEntityRelationOptionsByIds(relatedEntityIds),
		getResourceRelationOptionsByIds(relatedResourceIds),
	]);
	return (
		<NewsItemDetails
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			contentBlocks={contentBlocks}
			discardDraftAction={discardNewsItemDraftAction}
			documentId={doc.id}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			newsItem={{
				...newsItem,
				entityVersion: { ...newsItem.entityVersion, slug: entityVersionSlug },
				image: { ...newsItem.image, url: image.url },
			}}
			publishAction={publishNewsItemAction}
			selectedVersion={selectedVersion}
		/>
	);
}
