import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { InternalPageEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_components/internal-page-edit";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { ensureDraftVersion, getDocumentLifecycleState } from "@/lib/data/entity-lifecycle";
import { internalPagesLifecycleAdapter } from "@/lib/data/internal-pages.lifecycle-adapter";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditInternalPageProps extends PageProps<"/[locale]/dashboard/administrator/internal-pages/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditInternalPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit internal page"),
	});
}

export default async function DashboardAdministratorEditInternalPage(
	props: Readonly<DashboardAdministratorEditInternalPageProps>,
): Promise<ReactNode> {
	const { params } = props;
	const { slug } = await params;

	const anyVersion = await db.query.internalPages.findFirst({
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
		const draftVersionId = await ensureDraftVersion(tx, documentId, internalPagesLifecycleAdapter);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleState(tx, documentId);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const internalPage = await db.query.internalPages.findFirst({
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

	if (internalPage == null) {
		notFound();
	}

	const contentBlocks = await getEntityContentBlocks(internalPage.id, "content");

	return (
		<InternalPageEditForm
			contentBlocks={contentBlocks}
			documentId={documentId}
			hasDraftChanges={hasDraftChanges}
			internalPage={internalPage}
			isPublished={publishedId != null}
		/>
	);
}
