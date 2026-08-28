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
import { FundingCallForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_components/funding-call-form";
import { discardFundingCallDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_lib/discard-funding-call-draft.action";
import { publishFundingCallAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_lib/publish-funding-call.action";
import { updateFundingCallAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_lib/update-funding-call.action";

interface FundingCallEditFormProps {
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraftChanges: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	initialAssets: Array<{ key: string; label: string; url: string }>;
	initialRelatedEntityIds: Array<string>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceIds: Array<string>;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
	isPublished: boolean;
	fundingCall: Pick<schema.FundingCall, "id" | "duration" | "title" | "summary"> & {
		entityVersion: {
			entity: Pick<schema.Entity, "id">;
			status: Pick<schema.EntityStatus, "id" | "type">;
			slug: Pick<schema.Slug, "value">;
		};
	} & {
		image: SelectedImage;
		imageCaption: JSONContent | null;
		imageCaptionMode: ImageCaptionMode;
	};
	selectedRelatedEntities: Array<{ id: string; name: string; description?: string }>;
	selectedRelatedResources: Array<{ id: string; name: string; description?: string }>;
}

export function FundingCallEditForm(props: Readonly<FundingCallEditFormProps>): ReactNode {
	const {
		contentBlocks,
		documentId,
		hasDraftChanges,
		locales,
		selectedLocaleCode,
		initialAssets,
		initialRelatedEntityIds,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceIds,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		isPublished,
		fundingCall,
		selectedRelatedEntities,
		selectedRelatedResources,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader
				title={t("Edit funding call")}
				lifecycle={{
					documentId,
					hasDraft: hasDraftChanges,
					isPublished,
					publishAction: publishFundingCallAction,
					discardDraftAction: discardFundingCallDraftAction,
				}}
				localeSelector={
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				}
			/>

			<FundingCallForm
				contentBlocks={contentBlocks}
				initialAssets={initialAssets}
				initialRelatedEntityIds={initialRelatedEntityIds}
				initialRelatedEntityItems={initialRelatedEntityItems}
				initialRelatedEntityTotal={initialRelatedEntityTotal}
				initialRelatedResourceIds={initialRelatedResourceIds}
				initialRelatedResourceItems={initialRelatedResourceItems}
				initialRelatedResourceTotal={initialRelatedResourceTotal}
				isPublished={isPublished}
				formAction={updateFundingCallAction}
				fundingCall={fundingCall}
				selectedRelatedEntities={selectedRelatedEntities}
				selectedRelatedResources={selectedRelatedResources}
			/>
		</Fragment>
	);
}
