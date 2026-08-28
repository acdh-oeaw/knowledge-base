"use client";

import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import type * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import type { SelectedImage } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { PageItemForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/pages/_components/page-item-form";
import { discardPageItemDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/pages/_lib/discard-page-item-draft.action";
import { publishPageItemAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/pages/_lib/publish-page-item.action";
import { updatePageItemAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/pages/_lib/update-page-item.action";

interface PageItemEditFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraftChanges: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	pageItem: Pick<schema.Page, "id" | "publicationDate" | "title" | "summary"> & {
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & {
		image: SelectedImage | null;
		imageCaption: JSONContent | null;
		imageCaptionMode: ImageCaptionMode;
	};
	initialRelatedEntityIds: Array<string>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceIds: Array<string>;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
	selectedRelatedEntities: Array<{ id: string; name: string; description?: string }>;
	selectedRelatedResources: Array<{ id: string; name: string; description?: string }>;
}

export function PageItemEditForm(props: Readonly<PageItemEditFormProps>): ReactNode {
	const {
		initialAssets,
		contentBlocks,
		documentId,
		hasDraftChanges,
		isPublished,
		locales,
		selectedLocaleCode,
		pageItem,
		initialRelatedEntityIds,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceIds,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		selectedRelatedEntities,
		selectedRelatedResources,
	} = props;

	const t = useExtracted();
	const formId = "page-item-edit-form";

	return (
		<Fragment>
			<EntityFormHeader
				title={t("Edit page")}
				lifecycle={{
					documentId,
					hasDraft: hasDraftChanges,
					isPublished,
					publishAction: publishPageItemAction,
					discardDraftAction: discardPageItemDraftAction,
				}}
				localeSelector={
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				}
			/>

			<PageItemForm
				key={pageItem.id}
				contentBlocks={contentBlocks}
				isPublished={isPublished}
				formAction={updatePageItemAction}
				formId={formId}
				initialAssets={initialAssets}
				initialRelatedEntityIds={initialRelatedEntityIds}
				initialRelatedEntityItems={initialRelatedEntityItems}
				initialRelatedEntityTotal={initialRelatedEntityTotal}
				initialRelatedResourceIds={initialRelatedResourceIds}
				initialRelatedResourceItems={initialRelatedResourceItems}
				initialRelatedResourceTotal={initialRelatedResourceTotal}
				pageItem={pageItem}
				selectedRelatedEntities={selectedRelatedEntities}
				selectedRelatedResources={selectedRelatedResources}
			/>
		</Fragment>
	);
}
