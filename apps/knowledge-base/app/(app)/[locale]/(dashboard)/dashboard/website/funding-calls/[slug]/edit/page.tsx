import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { FundingCallEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_components/funding-call-edit";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { ensureDraftVersion, getDocumentLifecycleState } from "@/lib/data/entity-lifecycle";
import { fundingCallsLifecycleAdapter } from "@/lib/data/funding-calls.lifecycle-adapter";
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
	const { params } = props;

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

	const documentId = anyVersion.entityVersion.entity.id;

	const { draftVersionId, hasDraftChanges, publishedId } = await db.transaction(async (tx) => {
		const draftVersionId = await ensureDraftVersion(tx, documentId, fundingCallsLifecycleAdapter);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleState(tx, documentId);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const fundingCall = await db.query.fundingCalls.findFirst({
		where: { id: draftVersionId },
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
		<FundingCallEditForm
			contentBlocks={contentBlocks}
			documentId={documentId}
			fundingCall={{ ...fundingCall }}
			hasDraftChanges={hasDraftChanges}
			isPublished={publishedId != null}
		/>
	);
}
