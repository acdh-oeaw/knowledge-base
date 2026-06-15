import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DocumentationPageDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_components/documentation-page-details";
import { discardDocumentationPageDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_lib/discard-documentation-page-draft.action";
import { publishDocumentationPageAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_lib/publish-documentation-page.action";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getDocumentLifecycleState } from "@/lib/data/entity-lifecycle";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorDocumentationPageDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/documentation-pages/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorDocumentationPageDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Documentation page details"),
	});
}

export default async function DashboardAdministratorDocumentationPageDetailsPage(
	props: Readonly<DashboardAdministratorDocumentationPageDetailsPageProps>,
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

	const documentationPage = await db.query.documentationPages.findFirst({
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

	if (documentationPage == null) {
		notFound();
	}

	const contentBlocks = await getEntityContentBlocks(documentationPage.id, "content");
	const hasPublishableDraft = draftId != null && (publishedId == null || hasDraftChanges);

	return (
		<DocumentationPageDetails
			contentBlocks={contentBlocks}
			documentationPage={documentationPage}
			discardDraftAction={discardDocumentationPageDraftAction}
			documentId={doc.id}
			hasDraft={hasPublishableDraft}
			isPublished={publishedId != null}
			publishAction={publishDocumentationPageAction}
			selectedVersion={selectedVersion}
		/>
	);
}
