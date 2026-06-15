"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { InternalPageForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_components/internal-page-form";
import { discardInternalPageDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_lib/discard-internal-page-draft.action";
import { publishInternalPageAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_lib/publish-internal-page.action";
import { updateInternalPageAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_lib/update-internal-page.action";

interface InternalPageEditFormProps {
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraftChanges: boolean;
	internalPage: Pick<schema.InternalPage, "id" | "title"> & {
		entityVersion: { entity: Pick<schema.Entity, "id" | "slug"> };
	};
	isPublished: boolean;
}

export function InternalPageEditForm(props: Readonly<InternalPageEditFormProps>): ReactNode {
	const { contentBlocks, documentId, hasDraftChanges, internalPage, isPublished } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader
				title={t("Edit internal page")}
				lifecycle={{
					documentId,
					hasDraft: hasDraftChanges,
					isPublished,
					publishAction: publishInternalPageAction,
					discardDraftAction: discardInternalPageDraftAction,
				}}
			/>
			<InternalPageForm
				contentBlocks={contentBlocks}
				formAction={updateInternalPageAction}
				internalPage={internalPage}
			/>
		</Fragment>
	);
}
