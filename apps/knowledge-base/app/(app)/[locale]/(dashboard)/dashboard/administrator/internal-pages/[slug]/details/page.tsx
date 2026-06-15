import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { InternalPageDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_components/internal-page-details";
import { discardInternalPageDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_lib/discard-internal-page-draft.action";
import { publishInternalPageAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_lib/publish-internal-page.action";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getDocumentLifecycleState } from "@/lib/data/entity-lifecycle";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorInternalPageDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/internal-pages/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorInternalPageDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Internal page details"),
	});
}

export default async function DashboardAdministratorInternalPageDetailsPage(
	props: Readonly<DashboardAdministratorInternalPageDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;
	const { slug } = await params;

	const doc = await db.query.entities.findFirst({
		where: { slug },
		columns: { id: true },
	});

	if (doc == null) {
		notFound();
	}

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

	const internalPage = await db.query.internalPages.findFirst({
		where: { id: versionId },
		columns: {
			id: true,
			title: true,
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
				},
			},
		},
	});

	if (internalPage == null) {
		notFound();
	}

	const contentBlocks = await getEntityContentBlocks(internalPage.id, "content");
	const hasPublishableDraft = draftId != null && (publishedId == null || hasDraftChanges);

	return (
		<InternalPageDetails
			contentBlocks={contentBlocks}
			internalPage={internalPage}
			discardDraftAction={discardInternalPageDraftAction}
			documentId={doc.id}
			hasDraft={hasPublishableDraft}
			isPublished={publishedId != null}
			publishAction={publishInternalPageAction}
			selectedVersion={selectedVersion}
		/>
	);
}
