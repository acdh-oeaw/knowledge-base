import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DocumentOrPolicyEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_components/document-or-policy-edit";
import { imageGridOptions } from "@/config/assets.config";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { documentsPoliciesLifecycleAdapter } from "@/lib/data/documents-policies.lifecycle-adapter";
import { ensureDraftVersion, getDocumentLifecycleState } from "@/lib/data/entity-lifecycle";
import { db } from "@/lib/db";
import { asc } from "@/lib/db/sql";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteEditDocumentOrPolicyPageProps extends PageProps<"/[locale]/dashboard/website/documents-policies/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteEditDocumentOrPolicyPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Edit document or policy"),
	});

	return metadata;
}

export default async function DashboardWebsiteEditDocumentOrPolicyPage(
	props: Readonly<DashboardWebsiteEditDocumentOrPolicyPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { slug } = await params;

	const anyVersion = await db.query.documentsPolicies.findFirst({
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
		const draftVersionId = await ensureDraftVersion(
			tx,
			documentId,
			documentsPoliciesLifecycleAdapter,
		);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleState(tx, documentId);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const [{ items: initialAssets }, documentOrPolicy, groups] = await Promise.all([
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "documents" }),
		db.query.documentsPolicies.findFirst({
			where: { id: draftVersionId },
			columns: {
				id: true,
				title: true,
				summary: true,
				url: true,
				groupId: true,
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
		}),
		db.query.documentPolicyGroups.findMany({
			columns: { id: true, label: true },
			orderBy(t) {
				return [asc(t.position), asc(t.label)];
			},
		}),
	]);

	if (documentOrPolicy == null) {
		notFound();
	}

	const document = images.generateSignedImageUrl({
		key: documentOrPolicy.document.key,
		options: imageGridOptions,
	});
	const contentBlocks = await getEntityContentBlocks(documentOrPolicy.id, "description");

	return (
		<DocumentOrPolicyEditForm
			contentBlocks={contentBlocks}
			documentId={documentId}
			documentOrPolicy={{
				...documentOrPolicy,
				document: { ...documentOrPolicy.document, url: document.url },
			}}
			groups={groups}
			hasDraftChanges={hasDraftChanges}
			initialAssets={initialAssets}
			isPublished={publishedId != null}
		/>
	);
}
