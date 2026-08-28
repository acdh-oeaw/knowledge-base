import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { DocumentOrPolicyDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_components/document-or-policy-details";
import { discardDocumentOrPolicyDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/discard-document-or-policy-draft.action";
import { publishDocumentOrPolicyAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/publish-document-or-policy.action";
import { imageGridOptions } from "@/config/assets.config";
import { getResolvedEntityContentBlocks } from "@/lib/content-blocks-service";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteDocumentOrPolicyDetailsPageProps extends PageProps<"/[locale]/dashboard/website/documents-policies/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteDocumentOrPolicyDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Document or policy details"),
	});

	return metadata;
}

export default async function DashboardWebsiteDocumentOrPolicyDetailsPage(
	props: Readonly<DashboardWebsiteDocumentOrPolicyDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();

	const anyVersion = await db.query.documentsPolicies.findFirst({
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

	const documentOrPolicy = await db.query.documentsPolicies.findFirst({
		where: { id: versionId },
		columns: {
			id: true,
			title: true,
			summary: true,
			url: true,
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
			document: {
				columns: {
					key: true,
					label: true,
				},
			},
		},
	});

	if (documentOrPolicy == null) {
		notFound();
	}

	assert(
		documentOrPolicy.entityVersion.slug,
		`Slug missing for entity version "${documentOrPolicy.entityVersion.id}".`,
	);
	const entityVersionSlug = documentOrPolicy.entityVersion.slug;

	const document = images.generateSignedImageUrl({
		key: documentOrPolicy.document.key,
		options: imageGridOptions,
	});

	const downloadUrl = `/api/assets/download?key=${encodeURIComponent(documentOrPolicy.document.key)}`;

	const contentBlocks = await getResolvedEntityContentBlocks(documentOrPolicy.id, "description");

	return (
		<DocumentOrPolicyDetails
			contentBlocks={contentBlocks}
			discardDraftAction={discardDocumentOrPolicyDraftAction}
			documentId={doc.id}
			documentOrPolicy={{
				...documentOrPolicy,
				entityVersion: { ...documentOrPolicy.entityVersion, slug: entityVersionSlug },
				document: { ...documentOrPolicy.document, url: document.url, downloadUrl },
			}}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			publishAction={publishDocumentOrPolicyAction}
			selectedVersion={selectedVersion}
		/>
	);
}
