"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@acdh-knowledge-base/ui/description-list";
import { Note } from "@acdh-knowledge-base/ui/note";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { VersionSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/version-selector";

interface EventDetailsProps {
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraft: boolean;
	isLocaleFallback: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	selectedVersion: "draft" | "published";
	event: Pick<schema.Event, "id" | "duration" | "location" | "title" | "summary" | "website"> & {
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & { image: { key: string; label: string; url: string } };
	selectedRelatedEntities: Array<{ id: string; name: string; description?: string }>;
	selectedRelatedResources: Array<{ id: string; name: string; description?: string }>;
	publishAction: (documentId: string) => Promise<unknown>;
	discardDraftAction?: (documentId: string) => Promise<unknown>;
}

export function EventDetails(props: Readonly<EventDetailsProps>): ReactNode {
	const {
		contentBlocks,
		documentId,
		hasDraft,
		isLocaleFallback,
		isPublished,
		locales,
		event,
		publishAction,
		discardDraftAction,
		selectedLocaleCode,
		selectedRelatedEntities,
		selectedRelatedResources,
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
					draftHref={`/dashboard/website/events/${event.entityVersion.slug.value}/details`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishedHref={`/dashboard/website/events/${event.entityVersion.slug.value}/details?version=published`}
					selectedVersion={selectedVersion}
				/>
				<div className="flex items-center gap-x-4">
					<EntityLifecycleBar
						discardDraftAction={discardDraftAction}
						documentId={documentId}
						editHref={`/dashboard/website/events/${event.entityVersion.slug.value}/edit`}
						hasDraft={hasDraft}
						isPublished={isPublished}
						publishAction={publishAction}
					/>
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				</div>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Name")}</DescriptionTerm>
				<DescriptionDetails>{event.title}</DescriptionDetails>

				<DescriptionTerm>{t("Slug")}</DescriptionTerm>
				<DescriptionDetails>{event.entityVersion.slug.value}</DescriptionDetails>

				<DescriptionTerm>{t("Summary")}</DescriptionTerm>
				<DescriptionDetails>{event.summary}</DescriptionDetails>

				<DescriptionTerm>{t("Duration")}</DescriptionTerm>
				<DescriptionDetails>
					{event.duration.end
						? format.dateTimeRange(event.duration.start, event.duration.end, {
								dateStyle: "short",
							})
						: format.dateTime(event.duration.start, { dateStyle: "short" })}
				</DescriptionDetails>

				<DescriptionTerm>{t("Location")}</DescriptionTerm>
				<DescriptionDetails>{event.location}</DescriptionDetails>

				<DescriptionTerm>{t("Website")}</DescriptionTerm>
				<DescriptionDetails>{event.website}</DescriptionDetails>

				<DescriptionTerm>{t("Content")}</DescriptionTerm>
				<DescriptionDetails>
					<ContentBlocksView contentBlocks={contentBlocks} />
				</DescriptionDetails>

				<DescriptionTerm>{t("Image")}</DescriptionTerm>
				<DescriptionDetails>
					<img
						alt=""
						className="block-24 inline-auto max-inline-full rounded-lg object-contain"
						src={event.image.url}
					/>
				</DescriptionDetails>

				<DescriptionTerm>{t("Related entities")}</DescriptionTerm>
				<DescriptionDetails>
					{selectedRelatedEntities.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{selectedRelatedEntities.map((relatedEntity) => (
								<li key={relatedEntity.id} className="text-sm">
									<span className="font-medium">{relatedEntity.name}</span>
								</li>
							))}
						</ul>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Related resources")}</DescriptionTerm>
				<DescriptionDetails>
					{selectedRelatedResources.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{selectedRelatedResources.map((relatedResource) => (
								<li key={relatedResource.id} className="text-sm">
									<span className="font-medium">{relatedResource.name}</span>
								</li>
							))}
						</ul>
					) : null}
				</DescriptionDetails>
			</DescriptionList>
		</Fragment>
	);
}
