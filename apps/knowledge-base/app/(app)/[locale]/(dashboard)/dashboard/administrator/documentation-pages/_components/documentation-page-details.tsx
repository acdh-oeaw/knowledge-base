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

interface DocumentationPageDetailsProps {
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraft: boolean;
	isPublished: boolean;
	selectedVersion: "draft" | "published";
	documentationPage: Pick<schema.DocumentationPage, "title"> & {
		entityVersion: {
			entity: Pick<schema.Entity, "id">;
			slug: Pick<schema.Slug, "value">;
		};
	};
	publishAction?: (documentId: string) => Promise<unknown>;
	discardDraftAction?: (documentId: string) => Promise<unknown>;
}

export function DocumentationPageDetails(
	props: Readonly<DocumentationPageDetailsProps>,
): ReactNode {
	const {
		contentBlocks,
		documentId,
		hasDraft,
		isPublished,
		documentationPage,
		publishAction,
		discardDraftAction,
		selectedVersion,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<div className="flex items-center justify-between">
				<VersionSelector
					draftHref={`/dashboard/administrator/documentation-pages/${documentationPage.entityVersion.slug.value}/details`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishedHref={`/dashboard/administrator/documentation-pages/${documentationPage.entityVersion.slug.value}/details?version=published`}
					selectedVersion={selectedVersion}
				/>
				<EntityLifecycleBar
					discardDraftAction={discardDraftAction}
					documentId={documentId}
					editHref={`/dashboard/administrator/documentation-pages/${documentationPage.entityVersion.slug.value}/edit`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishAction={publishAction}
				/>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Title")}</DescriptionTerm>
				<DescriptionDetails>{documentationPage.title}</DescriptionDetails>

				<DescriptionTerm>{t("Slug")}</DescriptionTerm>
				<DescriptionDetails>{documentationPage.entityVersion.slug.value}</DescriptionDetails>

				<DescriptionTerm>{t("Content")}</DescriptionTerm>
				<DescriptionDetails>
					<ContentBlocksView contentBlocks={contentBlocks} />
				</DescriptionDetails>
			</DescriptionList>
		</Fragment>
	);
}
