import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { FundingCallDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_components/funding-call-details";
import { discardFundingCallDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_lib/discard-funding-call-draft.action";
import { publishFundingCallAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_lib/publish-funding-call.action";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getDocumentLifecycleState } from "@/lib/data/entity-lifecycle";
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

	const anyVersion = await db.query.fundingCalls.findFirst({
		where: { entityVersion: { entity: { slug } } },
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

	const { draftId, publishedId, hasDraftChanges } = await db.transaction(async (tx) =>
		getDocumentLifecycleState(tx, doc.id),
	);

	/**
	 * The version selector and "with draft changes" UX only kick in when the draft actually diverges
	 * from the published version. Right after publish, a draft row still exists as a clone of the new
	 * published version but has no real changes — we treat that as published-only.
	 */
	const showVersionSelector = hasDraftChanges && publishedId != null && draftId != null;

	const { version } = await searchParamsPromise;
	let selectedVersion: "draft" | "published";
	let versionId: string | null;

	if (showVersionSelector) {
		selectedVersion = version === "published" ? "published" : "draft";
		versionId = selectedVersion === "published" ? publishedId : draftId;
	} else if (publishedId != null) {
		selectedVersion = "published";
		versionId = publishedId;
	} else {
		selectedVersion = "draft";
		versionId = draftId;
	}

	if (versionId == null) {
		notFound();
	}

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
							slug: true,
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

	const contentBlocks = await getEntityContentBlocks(fundingCall.id, "content");

	return (
		<FundingCallDetails
			contentBlocks={contentBlocks}
			discardDraftAction={discardFundingCallDraftAction}
			documentId={doc.id}
			fundingCall={{ ...fundingCall }}
			hasDraft={hasDraftChanges}
			isPublished={publishedId != null}
			publishAction={publishFundingCallAction}
			selectedVersion={selectedVersion}
		/>
	);
}
