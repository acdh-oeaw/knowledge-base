import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { FundingCallEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_components/funding-call-edit";
import { imageGridOptions } from "@/config/assets.config";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import {
	ensureLocalizedDraftVersion,
	getDocumentLifecycleStateForLocale,
} from "@/lib/data/entity-lifecycle";
import { fundingCallsLifecycleAdapter } from "@/lib/data/funding-calls.lifecycle-adapter";
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
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteEditFundingCallPageProps extends PageProps<"/[locale]/dashboard/website/funding-calls/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteEditFundingCallPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit funding call"),
	});

	return metadata;
}

export default async function DashboardWebsiteEditFundingCallPage(
	props: Readonly<DashboardWebsiteEditFundingCallPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const anyVersion = await db.query.fundingCalls.findFirst({
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
			fundingCallsLifecycleAdapter,
			selectedLocale.id,
		);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleStateForLocale(
			tx,
			documentId,
			selectedLocale.id,
		);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const fundingCall = await db.query.fundingCalls.findFirst({
		where: { id: draftVersionId },
		columns: {
			id: true,
			imageCaption: true,
			imageCaptionMode: true,
			duration: true,
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

	if (fundingCall == null) {
		notFound();
	}

	assert(
		fundingCall.entityVersion.slug,
		`Slug missing for entity version "${fundingCall.entityVersion.id}".`,
	);
	const entityVersionSlug = fundingCall.entityVersion.slug;

	const image = toSelectedImage(fundingCall.image, imageGridOptions);

	const [contentBlocks, { items: initialAssets }, initialRelatedEntities, initialRelatedResources] =
		await Promise.all([
			getEntityContentBlocks(fundingCall.id, "content"),
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
		<FundingCallEditForm
			contentBlocks={contentBlocks}
			documentId={documentId}
			fundingCall={{
				...fundingCall,
				image,
				entityVersion: { ...fundingCall.entityVersion, slug: entityVersionSlug },
			}}
			hasDraftChanges={hasDraftChanges}
			initialAssets={initialAssets}
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
		/>
	);
}
