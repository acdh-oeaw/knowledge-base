"use client";

import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import type * as schema from "@dariah-eric/database/schema";
import { TabList, TabPanel } from "@dariah-eric/ui/tabs";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import {
	EntityEditTab,
	EntityEditTabs,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-edit-tabs";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import type { SelectedImage } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { ArticleContributorsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/_components/article-contributors-section";
import { SpotlightArticleForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_components/spotlight-article-form";
import { createSpotlightArticleContributorAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_lib/create-spotlight-article-contributor.action";
import { deleteSpotlightArticleContributorAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_lib/delete-spotlight-article-contributor.action";
import { discardSpotlightArticleDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_lib/discard-spotlight-article-draft.action";
import { publishSpotlightArticleAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_lib/publish-spotlight-article.action";
import { updateSpotlightArticleAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_lib/update-spotlight-article.action";
import type { AvailablePerson, SpotlightArticleContributor } from "@/lib/data/article-contributors";

interface SpotlightArticleEditFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraftChanges: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	spotlightArticle: Pick<
		schema.SpotlightArticle,
		"id" | "publicationDate" | "title" | "summary"
	> & {
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & {
		image: SelectedImage;
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
	contributors: Array<SpotlightArticleContributor>;
	initialPersonItems: Array<AvailablePerson>;
	initialPersonTotal: number;
}

export function SpotlightArticleEditForm(
	props: Readonly<SpotlightArticleEditFormProps>,
): ReactNode {
	const {
		initialAssets,
		contentBlocks,
		documentId,
		hasDraftChanges,
		isPublished,
		locales,
		selectedLocaleCode,
		spotlightArticle,
		initialRelatedEntityIds,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceIds,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		selectedRelatedEntities,
		selectedRelatedResources,
		contributors,
		initialPersonItems,
		initialPersonTotal,
	} = props;

	const t = useExtracted();
	const formId = "spotlight-article-edit-form";

	return (
		<Fragment>
			<EntityFormHeader title={t("Edit spotlight article")} />

			<EntityEditTabs defaultTab="details">
				<TabList aria-label={t("Edit spotlight article")}>
					<EntityEditTab id="details">{t("Details")}</EntityEditTab>
					<EntityEditTab id="contributors">{t("Contributors")}</EntityEditTab>
				</TabList>

				<TabPanel
					className="flex flex-col gap-y-(--layout-padding)"
					id="details"
					shouldPreserveState={true}
				>
					<div className="flex items-center justify-end gap-x-4">
						<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
						<EntityLifecycleBar
							discardDraftAction={discardSpotlightArticleDraftAction}
							documentId={documentId}
							hasDraft={hasDraftChanges}
							isPublished={isPublished}
							publishAction={publishSpotlightArticleAction}
						/>
					</div>

					<SpotlightArticleForm
						contentBlocks={contentBlocks}
						isPublished={isPublished}
						formAction={updateSpotlightArticleAction}
						formId={formId}
						initialAssets={initialAssets}
						initialRelatedEntityIds={initialRelatedEntityIds}
						initialRelatedEntityItems={initialRelatedEntityItems}
						initialRelatedEntityTotal={initialRelatedEntityTotal}
						initialRelatedResourceIds={initialRelatedResourceIds}
						initialRelatedResourceItems={initialRelatedResourceItems}
						initialRelatedResourceTotal={initialRelatedResourceTotal}
						spotlightArticle={spotlightArticle}
						selectedRelatedEntities={selectedRelatedEntities}
						selectedRelatedResources={selectedRelatedResources}
					/>
				</TabPanel>

				<TabPanel id="contributors" shouldPreserveState={true}>
					<ArticleContributorsSection
						articleId={documentId}
						contributors={contributors}
						createAction={createSpotlightArticleContributorAction}
						deleteAction={deleteSpotlightArticleContributorAction}
						initialPersonItems={initialPersonItems}
						initialPersonTotal={initialPersonTotal}
					/>
				</TabPanel>
			</EntityEditTabs>
		</Fragment>
	);
}
