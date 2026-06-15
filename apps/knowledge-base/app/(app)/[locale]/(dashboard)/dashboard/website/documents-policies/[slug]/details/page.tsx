import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DocumentOrPolicyDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_components/document-or-policy-details";
import { discardDocumentOrPolicyDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/discard-document-or-policy-draft.action";
import { publishDocumentOrPolicyAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/publish-document-or-policy.action";
import { imageGridOptions } from "@/config/assets.config";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getDocumentLifecycleState } from "@/lib/data/entity-lifecycle";
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
							slug: true,
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

	const document = images.generateSignedImageUrl({
		key: documentOrPolicy.document.key,
		options: imageGridOptions,
	});

	const downloadUrl = `/api/assets/download?key=${encodeURIComponent(documentOrPolicy.document.key)}`;

	const contentBlocks = await getEntityContentBlocks(documentOrPolicy.id, "description");
	const hasPublishableDraft = draftId != null && (publishedId == null || hasDraftChanges);

	return (
		<DocumentOrPolicyDetails
			contentBlocks={contentBlocks}
			discardDraftAction={discardDocumentOrPolicyDraftAction}
			documentId={doc.id}
			documentOrPolicy={{
				...documentOrPolicy,
				document: { ...documentOrPolicy.document, url: document.url, downloadUrl },
			}}
			hasDraft={hasPublishableDraft}
			isPublished={publishedId != null}
			publishAction={publishDocumentOrPolicyAction}
			selectedVersion={selectedVersion}
		/>
	);
}
