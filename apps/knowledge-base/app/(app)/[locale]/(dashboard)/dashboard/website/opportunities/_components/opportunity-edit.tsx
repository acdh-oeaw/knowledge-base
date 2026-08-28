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
import { OpportunityForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_components/opportunity-form";
import { discardOpportunityDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_lib/discard-opportunity-draft.action";
import { publishOpportunityAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_lib/publish-opportunity.action";
import { updateOpportunityAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_lib/update-opportunity.action";

interface OpportunityEditFormProps {
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
	opportunity: Pick<
		schema.Opportunity,
		"id" | "duration" | "sourceId" | "title" | "summary" | "website"
	> & {
		entityVersion: {
			entity: Pick<schema.Entity, "id">;
			slug: Pick<schema.Slug, "value">;
			status: Pick<schema.EntityStatus, "id" | "type">;
		};
		source: Pick<schema.OpportunitySource, "id" | "source">;
	} & {
		image: SelectedImage;
		imageCaption: JSONContent | null;
		imageCaptionMode: ImageCaptionMode;
	};
	selectedRelatedEntities: Array<{ id: string; name: string; description?: string }>;
	selectedRelatedResources: Array<{ id: string; name: string; description?: string }>;
	sources: Array<Pick<schema.OpportunitySource, "id" | "source">>;
}

export function OpportunityEditForm(props: Readonly<OpportunityEditFormProps>): ReactNode {
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
		opportunity,
		selectedRelatedEntities,
		selectedRelatedResources,
		sources,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader
				title={t("Edit opportunity")}
				lifecycle={{
					documentId,
					hasDraft: hasDraftChanges,
					isPublished,
					publishAction: publishOpportunityAction,
					discardDraftAction: discardOpportunityDraftAction,
				}}
				localeSelector={
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				}
			/>

			<OpportunityForm
				contentBlocks={contentBlocks}
				initialAssets={initialAssets}
				initialRelatedEntityIds={initialRelatedEntityIds}
				initialRelatedEntityItems={initialRelatedEntityItems}
				initialRelatedEntityTotal={initialRelatedEntityTotal}
				initialRelatedResourceIds={initialRelatedResourceIds}
				initialRelatedResourceItems={initialRelatedResourceItems}
				initialRelatedResourceTotal={initialRelatedResourceTotal}
				isPublished={isPublished}
				formAction={updateOpportunityAction}
				opportunity={opportunity}
				selectedRelatedEntities={selectedRelatedEntities}
				selectedRelatedResources={selectedRelatedResources}
				sources={sources}
			/>
		</Fragment>
	);
}
