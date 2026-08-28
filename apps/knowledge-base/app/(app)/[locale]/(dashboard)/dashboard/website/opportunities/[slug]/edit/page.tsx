import { assert } from "@acdh-oeaw/lib";
import { db } from "@dariah-eric/database/client";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { OpportunityEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_components/opportunity-edit";
import { imageGridOptions } from "@/config/assets.config";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import {
	ensureLocalizedDraftVersion,
	getDocumentLifecycleStateForLocale,
} from "@/lib/data/entity-lifecycle";
import { getLocales } from "@/lib/data/locales";
import { opportunitiesLifecycleAdapter } from "@/lib/data/opportunities.lifecycle-adapter";
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
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteEditOpportunityPageProps extends PageProps<"/[locale]/dashboard/website/opportunities/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteEditOpportunityPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit opportunity"),
	});

	return metadata;
}

export default async function DashboardWebsiteEditOpportunityPage(
	props: Readonly<DashboardWebsiteEditOpportunityPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const anyVersion = await db.query.opportunities.findFirst({
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
			opportunitiesLifecycleAdapter,
			selectedLocale.id,
		);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleStateForLocale(
			tx,
			documentId,
			selectedLocale.id,
		);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const opportunity = await db.query.opportunities.findFirst({
		where: { id: draftVersionId },
		columns: {
			id: true,
			imageCaption: true,
			imageCaptionMode: true,
			duration: true,
			sourceId: true,
			title: true,
			summary: true,
			website: true,
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
			source: {
				columns: {
					id: true,
					source: true,
				},
			},
			image: {
				columns: selectedImageColumns,
				with: selectedImageWith,
			},
		},
	});

	if (opportunity == null) {
		notFound();
	}

	assert(
		opportunity.entityVersion.slug,
		`Slug missing for entity version "${opportunity.entityVersion.id}".`,
	);
	const entityVersionSlug = opportunity.entityVersion.slug;

	const image = toSelectedImage(opportunity.image, imageGridOptions);

	const [
		contentBlocks,
		sources,
		{ items: initialAssets },
		initialRelatedEntities,
		initialRelatedResources,
	] = await Promise.all([
		getEntityContentBlocks(opportunity.id, "content"),
		db.query.opportunitySources.findMany({
			orderBy: { source: "asc" },
			columns: { id: true, source: true },
		}),
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "images" }),
		getEntityRelationOptions(),
		getResourceRelationOptions(),
	]);

	const { relatedEntityIds, relatedResourceIds } = await getEntityRelations(documentId);

	const [selectedRelatedEntities, selectedRelatedResources] = await Promise.all([
		getEntityRelationOptionsByIds(relatedEntityIds),
		getResourceRelationOptionsByIds(relatedResourceIds),
	]);

	return (
		<OpportunityEditForm
			contentBlocks={contentBlocks}
			documentId={documentId}
			hasDraftChanges={hasDraftChanges}
			isPublished={publishedId != null}
			opportunity={{
				...opportunity,
				image,
				entityVersion: { ...opportunity.entityVersion, slug: entityVersionSlug },
			}}
			initialAssets={initialAssets}
			initialRelatedEntityIds={relatedEntityIds}
			initialRelatedEntityItems={initialRelatedEntities.items}
			initialRelatedEntityTotal={initialRelatedEntities.total}
			initialRelatedResourceIds={relatedResourceIds}
			initialRelatedResourceItems={initialRelatedResources.items}
			initialRelatedResourceTotal={initialRelatedResources.total}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			sources={sources}
		/>
	);
}
