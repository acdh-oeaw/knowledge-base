"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { OpportunityForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_components/opportunity-form";
import { discardOpportunityDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_lib/discard-opportunity-draft.action";
import { publishOpportunityAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_lib/publish-opportunity.action";
import { updateOpportunityAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_lib/update-opportunity.action";

interface OpportunityEditFormProps {
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraftChanges: boolean;
	isPublished: boolean;
	opportunity: Pick<
		schema.Opportunity,
		"id" | "duration" | "sourceId" | "title" | "summary" | "website"
	> & {
		entityVersion: {
			entity: Pick<schema.Entity, "id" | "slug">;
			status: Pick<schema.EntityStatus, "id" | "type">;
		};
		source: Pick<schema.OpportunitySource, "id" | "source">;
	};
	sources: Array<Pick<schema.OpportunitySource, "id" | "source">>;
}

export function OpportunityEditForm(props: Readonly<OpportunityEditFormProps>): ReactNode {
	const { contentBlocks, documentId, hasDraftChanges, isPublished, opportunity, sources } = props;

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
			/>

			<OpportunityForm
				contentBlocks={contentBlocks}
				formAction={updateOpportunityAction}
				opportunity={opportunity}
				sources={sources}
			/>
		</Fragment>
	);
}
