import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SpotlightArticleEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_components/spotlight-article-edit";
import { imageGridOptions } from "@/config/assets.config";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getSpotlightArticleContributors } from "@/lib/data/article-contributors";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getContributionPersonOptions } from "@/lib/data/contributions";
import {
	ensureLocalizedDraftVersion,
	getDocumentLifecycleStateForLocale,
} from "@/lib/data/entity-lifecycle";
import { getLocales } from "@/lib/data/locales";
import {
	getEntityRelationOptions,
	getEntityRelationOptionsByIds,
	getEntityRelations,
	getResourceRelationOptions,
	getResourceRelationOptionsByIds,
} from "@/lib/data/relations";
import {
	selectedImageColumns,
	selectedImageWith,
	toSelectedImage,
} from "@/lib/data/selected-image";
import { spotlightArticlesLifecycleAdapter } from "@/lib/data/spotlight-articles.lifecycle-adapter";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteEditSpotlightArticlePageProps extends PageProps<"/[locale]/dashboard/website/spotlight-articles/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteEditSpotlightArticlePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Edit spotlight article"),
	});

	return metadata;
}

export default async function DashboardWebsiteEditSpotlightArticlePage(
	props: Readonly<DashboardWebsiteEditSpotlightArticlePageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

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

	const documentId = anyVersion.entityVersion.entity.id;

	const { locale: localeParam } = await searchParamsPromise;

	const locales = await getLocales();
	const requestedLocale = locales.find((locale) => locale.code === localeParam);
	const selectedLocale =
		requestedLocale ?? locales.find((locale) => locale.isDefault) ?? locales[0];

	if (selectedLocale == null) {
		notFound();
	}

	const { draftVersionId, hasDraftChanges, publishedId } = await db.transaction(async (tx) => {
		const { versionId: draftVersionId } = await ensureLocalizedDraftVersion(
			tx,
			documentId,
			spotlightArticlesLifecycleAdapter,
			selectedLocale.id,
		);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleStateForLocale(
			tx,
			documentId,
			selectedLocale.id,
		);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const [
		{ items: initialAssets },
		spotlightArticle,
		initialRelatedEntities,
		initialRelatedResources,
		initialPersons,
	] = await Promise.all([
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "images" }),
		db.query.spotlightArticles.findFirst({
			where: { id: draftVersionId },
			columns: {
				id: true,
				imageCaption: true,
				imageCaptionMode: true,
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
		}),
		getEntityRelationOptions(),
		getResourceRelationOptions(),
		getContributionPersonOptions(),
	]);

	if (spotlightArticle == null) {
		notFound();
	}

	assert(
		spotlightArticle.entityVersion.slug,
		`Slug missing for entity version "${spotlightArticle.entityVersion.id}".`,
	);
	const entityVersionSlug = spotlightArticle.entityVersion.slug;

	const image = toSelectedImage(spotlightArticle.image, imageGridOptions);
	const [{ relatedEntityIds, relatedResourceIds }, contributors, contentBlocks] = await Promise.all(
		[
			getEntityRelations(documentId),
			getSpotlightArticleContributors(documentId),
			getEntityContentBlocks(draftVersionId, "content"),
		],
	);

	const [selectedRelatedEntities, selectedRelatedResources] = await Promise.all([
		getEntityRelationOptionsByIds(relatedEntityIds),
		getResourceRelationOptionsByIds(relatedResourceIds),
	]);

	return (
		<SpotlightArticleEditForm
			contentBlocks={contentBlocks}
			contributors={contributors}
			documentId={documentId}
			hasDraftChanges={hasDraftChanges}
			initialAssets={initialAssets}
			initialPersonItems={initialPersons.items}
			initialPersonTotal={initialPersons.total}
			initialRelatedEntityIds={relatedEntityIds}
			initialRelatedEntityItems={initialRelatedEntities.items}
			initialRelatedEntityTotal={initialRelatedEntities.total}
			initialRelatedResourceIds={relatedResourceIds}
			initialRelatedResourceItems={initialRelatedResources.items}
			initialRelatedResourceTotal={initialRelatedResources.total}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			spotlightArticle={{
				...spotlightArticle,
				entityVersion: { ...spotlightArticle.entityVersion, slug: entityVersionSlug },
				image,
			}}
		/>
	);
}
