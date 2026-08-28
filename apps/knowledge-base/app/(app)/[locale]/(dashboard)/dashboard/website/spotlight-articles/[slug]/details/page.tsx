import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { SpotlightArticleDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_components/spotlight-article-details";
import { discardSpotlightArticleDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_lib/discard-spotlight-article-draft.action";
import { publishSpotlightArticleAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_lib/publish-spotlight-article.action";
import { imageGridOptions } from "@/config/assets.config";
import { getResolvedEntityContentBlocks } from "@/lib/content-blocks-service";
import { getSpotlightArticleContributors } from "@/lib/data/article-contributors";
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

interface DashboardWebsiteSpotlightArticleDetailsPageProps extends PageProps<"/[locale]/dashboard/website/spotlight-articles/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteSpotlightArticleDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Spotlight article details"),
	});

	return metadata;
}

export default async function DashboardWebsiteSpotlightArticleDetailsPage(
	props: Readonly<DashboardWebsiteSpotlightArticleDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();

	const anyVersion = await db.query.spotlightArticles.findFirst({
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

	const spotlightArticle = await db.query.spotlightArticles.findFirst({
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
				},
			},
			image: {
				columns: selectedImageColumns,
				with: selectedImageWith,
			},
		},
	});

	if (spotlightArticle == null) {
		notFound();
	}

	assert(
		spotlightArticle.entityVersion.slug,
		`Slug missing for entity version "${spotlightArticle.entityVersion.id}".`,
	);
	const entityVersionSlug = spotlightArticle.entityVersion.slug;

	const image = toSelectedImage(spotlightArticle.image, imageGridOptions);

	const contentBlocks = await getResolvedEntityContentBlocks(spotlightArticle.id, "content");

	const { relatedEntityIds, relatedResourceIds } = await getEntityRelations(doc.id);

	const [selectedRelatedEntities, selectedRelatedResources, spotlightArticleContributors] =
		await Promise.all([
			getEntityRelationOptionsByIds(relatedEntityIds),
			getResourceRelationOptionsByIds(relatedResourceIds),
			getSpotlightArticleContributors(doc.id),
		]);

	return (
		<SpotlightArticleDetails
			contributors={spotlightArticleContributors}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			contentBlocks={contentBlocks}
			discardDraftAction={discardSpotlightArticleDraftAction}
			documentId={doc.id}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			publishAction={publishSpotlightArticleAction}
			selectedVersion={selectedVersion}
			spotlightArticle={{
				...spotlightArticle,
				entityVersion: { ...spotlightArticle.entityVersion, slug: entityVersionSlug },
				image,
			}}
		/>
	);
}
