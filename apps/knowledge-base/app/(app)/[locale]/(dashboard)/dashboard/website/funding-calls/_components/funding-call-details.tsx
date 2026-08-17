"use client";

import type * as schema from "@dariah-eric/database/schema";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@dariah-eric/ui/description-list";
import { Note } from "@dariah-eric/ui/note";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { VersionSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/version-selector";

interface FundingCallDetailsProps {
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraft: boolean;
	isLocaleFallback: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	selectedVersion: "draft" | "published";
	fundingCall: Pick<schema.FundingCall, "id" | "duration" | "title" | "summary"> & {
		entityVersion: { entity: { id: string }; slug: { value: string } };
	};
	publishAction: (documentId: string) => Promise<unknown>;
	discardDraftAction?: (documentId: string) => Promise<unknown>;
}

export function FundingCallDetails(props: Readonly<FundingCallDetailsProps>): ReactNode {
	const {
		contentBlocks,
		documentId,
		hasDraft,
		isLocaleFallback,
		isPublished,
		locales,
		fundingCall,
		publishAction,
		discardDraftAction,
		selectedLocaleCode,
		selectedVersion,
	} = props;

	const t = useExtracted();
	const format = useFormatter();

	return (
		<Fragment>
			{isLocaleFallback ? (
				<Note intent="info">
					{t("Not yet translated in the selected language — showing the default language.")}
				</Note>
			) : null}
			<div className="flex items-center justify-between">
				<VersionSelector
					draftHref={`/dashboard/website/funding-calls/${fundingCall.entityVersion.slug.value}/details`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishedHref={`/dashboard/website/funding-calls/${fundingCall.entityVersion.slug.value}/details?version=published`}
					selectedVersion={selectedVersion}
				/>
				<div className="flex items-center gap-x-4">
					<EntityLifecycleBar
						discardDraftAction={discardDraftAction}
						documentId={documentId}
						editHref={`/dashboard/website/funding-calls/${fundingCall.entityVersion.slug.value}/edit`}
						hasDraft={hasDraft}
						isPublished={isPublished}
						publishAction={publishAction}
					/>
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				</div>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Title")}</DescriptionTerm>
				<DescriptionDetails>{fundingCall.title}</DescriptionDetails>

				<DescriptionTerm>{t("Slug")}</DescriptionTerm>
				<DescriptionDetails>{fundingCall.entityVersion.slug.value}</DescriptionDetails>

				<DescriptionTerm>{t("Summary")}</DescriptionTerm>
				<DescriptionDetails>{fundingCall.summary}</DescriptionDetails>

				<DescriptionTerm>{t("Duration")}</DescriptionTerm>
				<DescriptionDetails>
					{fundingCall.duration.end
						? format.dateTimeRange(fundingCall.duration.start, fundingCall.duration.end, {
								dateStyle: "short",
							})
						: format.dateTime(fundingCall.duration.start, { dateStyle: "short" })}
				</DescriptionDetails>

				<DescriptionTerm>{t("Content")}</DescriptionTerm>
				<DescriptionDetails>
					<ContentBlocksView contentBlocks={contentBlocks} />
				</DescriptionDetails>
			</DescriptionList>
		</Fragment>
	);
}
