import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { FundingCallDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_components/funding-call-details";
import { discardFundingCallDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_lib/discard-funding-call-draft.action";
import { publishFundingCallAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_lib/publish-funding-call.action";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteFundingCallsDetailsPageProps extends PageProps<"/[locale]/dashboard/website/funding-calls/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteFundingCallsDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Funding call details"),
	});

	return metadata;
}

export default async function DashboardWebsiteFundingCallsDetailsPage(
	props: Readonly<DashboardWebsiteFundingCallsDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();

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

	const fundingCall = await db.query.fundingCalls.findFirst({
		where: { id: versionId },
		columns: {
			id: true,
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

	const contentBlocks = await getEntityContentBlocks(fundingCall.id, "content");

	return (
		<FundingCallDetails
			contentBlocks={contentBlocks}
			discardDraftAction={discardFundingCallDraftAction}
			documentId={doc.id}
			fundingCall={{
				...fundingCall,
				entityVersion: { ...fundingCall.entityVersion, slug: entityVersionSlug },
			}}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			publishAction={publishFundingCallAction}
			selectedVersion={selectedVersion}
		/>
	);
}
