import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DocumentationPageEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_components/documentation-page-edit";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { documentationPagesLifecycleAdapter } from "@/lib/data/documentation-pages.lifecycle-adapter";
import { ensureDraftVersion, getDocumentLifecycleState } from "@/lib/data/entity-lifecycle";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditDocumentationPageProps extends PageProps<"/[locale]/dashboard/administrator/documentation-pages/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditDocumentationPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit documentation page"),
	});
}

export default async function DashboardAdministratorEditDocumentationPage(
	props: Readonly<DashboardAdministratorEditDocumentationPageProps>,
): Promise<ReactNode> {
	const { params } = props;
	const { slug } = await params;

	const anyVersion = await db.query.documentationPages.findFirst({
		where: {
			entityVersion: {
				entity: {
					slug,
				},
			},
		},
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
			documentationPagesLifecycleAdapter,
		);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleState(tx, documentId);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const documentationPage = await db.query.documentationPages.findFirst({
		where: { id: draftVersionId },
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

	return (
		<DocumentationPageEditForm
			contentBlocks={contentBlocks}
			documentId={documentId}
			documentationPage={documentationPage}
			hasDraftChanges={hasDraftChanges}
			isPublished={publishedId != null}
		/>
	);
}
