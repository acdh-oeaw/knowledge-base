"use client";

import type * as schema from "@dariah-eric/database/schema";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@dariah-eric/ui/description-list";
import { Note } from "@dariah-eric/ui/note";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { RelationStatement } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-statement";
import { VersionSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/version-selector";
import type { ImpactCaseStudyContributor } from "@/lib/data/article-contributors";
import { formatRoleType } from "@/lib/format-role-type";

interface ImpactCaseStudyDetailsProps {
	contentBlocks: Array<ContentBlock>;
	contributors: Array<ImpactCaseStudyContributor>;
	documentId: string;
	hasDraft: boolean;
	isLocaleFallback: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	selectedVersion: "draft" | "published";
	impactCaseStudy: Pick<schema.ImpactCaseStudy, "id" | "title" | "summary"> & {
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & { image: { key: string; label: string; url: string } };
	selectedRelatedEntities: Array<{ id: string; name: string; description?: string }>;
	selectedRelatedResources: Array<{ id: string; name: string; description?: string }>;
	publishAction: (documentId: string) => Promise<unknown>;
	discardDraftAction?: (documentId: string) => Promise<unknown>;
}

export function ImpactCaseStudyDetails(props: Readonly<ImpactCaseStudyDetailsProps>): ReactNode {
	const {
		contentBlocks,
		contributors,
		documentId,
		hasDraft,
		isLocaleFallback,
		isPublished,
		locales,
		impactCaseStudy,
		publishAction,
		discardDraftAction,
		selectedLocaleCode,
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedVersion,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			{isLocaleFallback ? (
				<Note intent="info">
					{t("Not yet translated in the selected language — showing the default language.")}
				</Note>
			) : null}
			<div className="flex items-center justify-between">
				<VersionSelector
					draftHref={`/dashboard/website/impact-case-studies/${impactCaseStudy.entityVersion.slug.value}/details`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishedHref={`/dashboard/website/impact-case-studies/${impactCaseStudy.entityVersion.slug.value}/details?version=published`}
					selectedVersion={selectedVersion}
				/>
				<div className="flex items-center gap-x-4">
					<EntityLifecycleBar
						discardDraftAction={discardDraftAction}
						documentId={documentId}
						editHref={`/dashboard/website/impact-case-studies/${impactCaseStudy.entityVersion.slug.value}/edit`}
						hasDraft={hasDraft}
						isPublished={isPublished}
						publishAction={publishAction}
					/>
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				</div>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Title")}</DescriptionTerm>
				<DescriptionDetails>{impactCaseStudy.title}</DescriptionDetails>

				<DescriptionTerm>{t("Slug")}</DescriptionTerm>
				<DescriptionDetails>{impactCaseStudy.entityVersion.slug.value}</DescriptionDetails>

				<DescriptionTerm>{t("Summary")}</DescriptionTerm>
				<DescriptionDetails>{impactCaseStudy.summary}</DescriptionDetails>

				<DescriptionTerm>{t("Image")}</DescriptionTerm>
				<DescriptionDetails>
					<img
						alt=""
						className="block-24 inline-auto max-inline-full rounded-lg object-contain"
						src={impactCaseStudy.image.url}
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

				<DescriptionTerm>{t("Contributors")}</DescriptionTerm>
				<DescriptionDetails>
					{contributors.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{contributors.map((contributor) => (
								<RelationStatement
									key={contributor.personId}
									relation={formatRoleType(contributor.role)}
									showSource={false}
									source={impactCaseStudy.title}
									target={contributor.personName}
								/>
							))}
						</ul>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Content")}</DescriptionTerm>
				<DescriptionDetails>
					<ContentBlocksView contentBlocks={contentBlocks} />
				</DescriptionDetails>
			</DescriptionList>
		</Fragment>
	);
}
