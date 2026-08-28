import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { EventDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_components/event-details";
import { discardEventDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_lib/discard-event-draft.action";
import { publishEventAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_lib/publish-event.action";
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

interface DashboardWebsiteEventDetailsPageProps extends PageProps<"/[locale]/dashboard/website/events/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteEventDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Event details"),
	});

	return metadata;
}

export default async function DashboardWebsiteEventDetailsPage(
	props: Readonly<DashboardWebsiteEventDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();

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

	const event = await db.query.events.findFirst({
		where: { id: versionId },
		columns: {
			imageCaption: true,
			imageCaptionMode: true,
			id: true,
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
	});

	if (event == null) {
		notFound();
	}

	assert(event.entityVersion.slug, `Slug missing for entity version "${event.entityVersion.id}".`);
	const entityVersionSlug = event.entityVersion.slug;

	const image = toSelectedImage(event.image, imageGridOptions);

	const contentBlocks = await getResolvedEntityContentBlocks(event.id, "content");

	const { relatedEntityIds, relatedResourceIds } = await getEntityRelations(doc.id);

	const [selectedRelatedEntities, selectedRelatedResources] = await Promise.all([
		getEntityRelationOptionsByIds(relatedEntityIds),
		getResourceRelationOptionsByIds(relatedResourceIds),
	]);

	return (
		<EventDetails
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			contentBlocks={contentBlocks}
			discardDraftAction={discardEventDraftAction}
			documentId={doc.id}
			event={{
				...event,
				entityVersion: { ...event.entityVersion, slug: entityVersionSlug },
				image,
			}}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			publishAction={publishEventAction}
			selectedVersion={selectedVersion}
		/>
	);
}
