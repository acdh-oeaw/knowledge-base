import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { EventEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_components/event-edit";
import { imageGridOptions } from "@/config/assets.config";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import {
	ensureLocalizedDraftVersion,
	getDocumentLifecycleStateForLocale,
} from "@/lib/data/entity-lifecycle";
import { eventsLifecycleAdapter } from "@/lib/data/events.lifecycle-adapter";
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

interface DashboardWebsiteEditEventPageProps extends PageProps<"/[locale]/dashboard/website/events/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteEditEventPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit event"),
	});

	return metadata;
}

export default async function DashboardWebsiteEditEventPage(
	props: Readonly<DashboardWebsiteEditEventPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const anyVersion = await db.query.events.findFirst({
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
			eventsLifecycleAdapter,
			selectedLocale.id,
		);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleStateForLocale(
			tx,
			documentId,
			selectedLocale.id,
		);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const [{ items: initialAssets }, event, initialRelatedEntities, initialRelatedResources] =
		await Promise.all([
			getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "images" }),
			db.query.events.findFirst({
				where: { id: draftVersionId },
				columns: {
					id: true,
					imageCaption: true,
					imageCaptionMode: true,
					duration: true,
					isFullDay: true,
					location: true,
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
					image: {
						columns: selectedImageColumns,
						with: selectedImageWith,
					},
				},
			}),
			getEntityRelationOptions(),
			getResourceRelationOptions(),
		]);

	if (event == null) {
		notFound();
	}

	assert(event.entityVersion.slug, `Slug missing for entity version "${event.entityVersion.id}".`);
	const entityVersionSlug = event.entityVersion.slug;

	const image = toSelectedImage(event.image, imageGridOptions);

	const contentBlocks = await getEntityContentBlocks(event.id, "content");

	const { relatedEntityIds, relatedResourceIds } = await getEntityRelations(documentId);

	const [selectedRelatedEntities, selectedRelatedResources] = await Promise.all([
		getEntityRelationOptionsByIds(relatedEntityIds),
		getResourceRelationOptionsByIds(relatedResourceIds),
	]);

	return (
		<EventEditForm
			contentBlocks={contentBlocks}
			documentId={documentId}
			event={{
				...event,
				entityVersion: { ...event.entityVersion, slug: entityVersionSlug },
				image: { ...event.image, url: image.url },
			}}
			hasDraftChanges={hasDraftChanges}
			initialAssets={initialAssets}
			initialRelatedEntityIds={relatedEntityIds}
			initialRelatedEntityItems={initialRelatedEntities.items}
			initialRelatedEntityTotal={initialRelatedEntities.total}
			initialRelatedResourceIds={relatedResourceIds}
			initialRelatedResourceItems={initialRelatedResources.items}
			initialRelatedResourceTotal={initialRelatedResources.total}
			isDefaultLocale={selectedLocale.isDefault}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
		/>
	);
}
