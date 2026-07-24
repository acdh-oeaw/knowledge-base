import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { PageItemDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/pages/_components/page-details";
import { discardPageItemDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/pages/_lib/discard-page-item-draft.action";
import { publishPageItemAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/pages/_lib/publish-page-item.action";
import { imageGridOptions } from "@/config/assets.config";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import {
	getEntityRelationOptionsByIds,
	getEntityRelations,
	getResourceRelationOptionsByIds,
} from "@/lib/data/relations";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsitePageItemDetailsPageProps extends PageProps<"/[locale]/dashboard/website/pages/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsitePageItemDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Page details"),
	});

	return metadata;
}

export default async function DashboardWebsitePageItemDetailsPage(
	props: Readonly<DashboardWebsitePageItemDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();

	const anyVersion = await db.query.pages.findFirst({
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

	const pageItem = await db.query.pages.findFirst({
		where: { id: versionId },
		columns: {
			id: true,
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
				columns: {
					key: true,
					label: true,
				},
			},
		},
	});

	if (pageItem == null) {
		notFound();
	}

	assert(
		pageItem.entityVersion.slug,
		`Slug missing for entity version "${pageItem.entityVersion.id}".`,
	);
	const entityVersionSlug = pageItem.entityVersion.slug;

	const image = pageItem.image
		? images.generateSignedImageUrl({
				key: pageItem.image.key,
				options: imageGridOptions,
			})
		: null;

	const contentBlocks = await getEntityContentBlocks(pageItem.id, "content");

	const { relatedEntityIds, relatedResourceIds } = await getEntityRelations(doc.id);

	const [selectedRelatedEntities, selectedRelatedResources] = await Promise.all([
		getEntityRelationOptionsByIds(relatedEntityIds),
		getResourceRelationOptionsByIds(relatedResourceIds),
	]);

	return (
		<PageItemDetails
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			contentBlocks={contentBlocks}
			discardDraftAction={discardPageItemDraftAction}
			documentId={doc.id}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			pageItem={{
				...pageItem,
				entityVersion: { ...pageItem.entityVersion, slug: entityVersionSlug },
				image: pageItem.image ? { ...pageItem.image, url: image!.url } : null,
			}}
			publishAction={publishPageItemAction}
			selectedVersion={selectedVersion}
		/>
	);
}
