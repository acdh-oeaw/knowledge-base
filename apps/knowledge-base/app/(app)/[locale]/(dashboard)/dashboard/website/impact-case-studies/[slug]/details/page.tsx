import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { ImpactCaseStudyDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/impact-case-studies/_components/impact-case-study-details";
import { discardImpactCaseStudyDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/impact-case-studies/_lib/discard-impact-case-study-draft.action";
import { publishImpactCaseStudyAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/impact-case-studies/_lib/publish-impact-case-study.action";
import { imageGridOptions } from "@/config/assets.config";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getImpactCaseStudyContributors } from "@/lib/data/article-contributors";
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

interface DashboardWebsiteImpactCaseStudyDetailsPageProps extends PageProps<"/[locale]/dashboard/website/impact-case-studies/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteImpactCaseStudyDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Impact case study details"),
	});

	return metadata;
}

export default async function DashboardWebsiteImpactCaseStudyDetailsPage(
	props: Readonly<DashboardWebsiteImpactCaseStudyDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();

	const anyVersion = await db.query.impactCaseStudies.findFirst({
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

	const impactCaseStudy = await db.query.impactCaseStudies.findFirst({
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

	if (impactCaseStudy == null) {
		notFound();
	}

	assert(
		impactCaseStudy.entityVersion.slug,
		`Slug missing for entity version "${impactCaseStudy.entityVersion.id}".`,
	);
	const entityVersionSlug = impactCaseStudy.entityVersion.slug;

	const image = images.generateSignedImageUrl({
		key: impactCaseStudy.image.key,
		options: imageGridOptions,
	});

	const contentBlocks = await getEntityContentBlocks(impactCaseStudy.id, "content");

	const { relatedEntityIds, relatedResourceIds } = await getEntityRelations(doc.id);

	const [selectedRelatedEntities, selectedRelatedResources, impactCaseStudyContributors] =
		await Promise.all([
			getEntityRelationOptionsByIds(relatedEntityIds),
			getResourceRelationOptionsByIds(relatedResourceIds),
			getImpactCaseStudyContributors(doc.id),
		]);

	return (
		<ImpactCaseStudyDetails
			contributors={impactCaseStudyContributors}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			contentBlocks={contentBlocks}
			discardDraftAction={discardImpactCaseStudyDraftAction}
			documentId={doc.id}
			hasDraft={hasDraftChanges}
			impactCaseStudy={{
				...impactCaseStudy,
				entityVersion: { ...impactCaseStudy.entityVersion, slug: entityVersionSlug },
				image: { ...impactCaseStudy.image, url: image.url },
			}}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			publishAction={publishImpactCaseStudyAction}
			selectedVersion={selectedVersion}
		/>
	);
}
