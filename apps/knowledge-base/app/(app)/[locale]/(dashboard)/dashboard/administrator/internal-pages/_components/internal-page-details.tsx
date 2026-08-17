"use client";

import type * as schema from "@dariah-eric/database/schema";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@dariah-eric/ui/description-list";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { VersionSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/version-selector";

interface InternalPageDetailsProps {
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraft: boolean;
	isPublished: boolean;
	selectedVersion: "draft" | "published";
	internalPage: Pick<schema.InternalPage, "title"> & {
		entityVersion: {
			entity: Pick<schema.Entity, "id">;
			slug: Pick<schema.Slug, "value">;
		};
	};
	publishAction?: (documentId: string) => Promise<unknown>;
	discardDraftAction?: (documentId: string) => Promise<unknown>;
}

export function InternalPageDetails(props: Readonly<InternalPageDetailsProps>): ReactNode {
	const {
		contentBlocks,
		documentId,
		hasDraft,
		isPublished,
		internalPage,
		publishAction,
		discardDraftAction,
		selectedVersion,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<div className="flex items-center justify-between">
				<VersionSelector
					draftHref={`/dashboard/administrator/internal-pages/${internalPage.entityVersion.slug.value}/details`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishedHref={`/dashboard/administrator/internal-pages/${internalPage.entityVersion.slug.value}/details?version=published`}
					selectedVersion={selectedVersion}
				/>
				<EntityLifecycleBar
					discardDraftAction={discardDraftAction}
					documentId={documentId}
					editHref={`/dashboard/administrator/internal-pages/${internalPage.entityVersion.slug.value}/edit`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishAction={publishAction}
				/>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Title")}</DescriptionTerm>
				<DescriptionDetails>{internalPage.title}</DescriptionDetails>

				<DescriptionTerm>{t("Slug")}</DescriptionTerm>
				<DescriptionDetails>{internalPage.entityVersion.slug.value}</DescriptionDetails>

				<DescriptionTerm>{t("Content")}</DescriptionTerm>
				<DescriptionDetails>
					<ContentBlocksView contentBlocks={contentBlocks} />
				</DescriptionDetails>
			</DescriptionList>
		</Fragment>
	);
}
