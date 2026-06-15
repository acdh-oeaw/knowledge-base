"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { DocumentationPageForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_components/documentation-page-form";
import { discardDocumentationPageDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_lib/discard-documentation-page-draft.action";
import { publishDocumentationPageAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_lib/publish-documentation-page.action";
import { updateDocumentationPageAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_lib/update-documentation-page.action";

interface DocumentationPageEditFormProps {
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	documentationPage: Pick<schema.DocumentationPage, "id" | "title"> & {
		entityVersion: { entity: Pick<schema.Entity, "id" | "slug"> };
	};
	hasDraftChanges: boolean;
	isPublished: boolean;
}

export function DocumentationPageEditForm(
	props: Readonly<DocumentationPageEditFormProps>,
): ReactNode {
	const { contentBlocks, documentId, documentationPage, hasDraftChanges, isPublished } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader
				title={t("Edit documentation page")}
				lifecycle={{
					documentId,
					hasDraft: hasDraftChanges,
					isPublished,
					publishAction: publishDocumentationPageAction,
					discardDraftAction: discardDocumentationPageDraftAction,
				}}
			/>
			<DocumentationPageForm
				contentBlocks={contentBlocks}
				documentationPage={documentationPage}
				formAction={updateDocumentationPageAction}
			/>
		</Fragment>
	);
}
