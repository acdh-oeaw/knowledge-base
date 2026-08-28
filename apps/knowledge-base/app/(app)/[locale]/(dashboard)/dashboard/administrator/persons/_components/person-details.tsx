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

import type { SelectedImage } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/asset-summary";
import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { FeaturedImageDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/featured-image-details";
import { LocaleFallbackMark } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-fallback-mark";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { RelationStatement } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-statement";
import { VersionSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/version-selector";
import type { PersonArticle } from "@/lib/data/article-contributors";
import type { PersonContribution } from "@/lib/data/contributions";
import type { PersonSocialMediaEntry } from "@/lib/data/person-social-media";
import { getEntityDetailHref, getOrganisationalUnitDetailHref } from "@/lib/entity-detail-href";
import { getEntityTypeLabel } from "@/lib/entity-type-label";
import { getOrcidUrl } from "@/lib/external-identifier-url";
import { formatRoleType } from "@/lib/format-role-type";
import { getSocialMediaTypeLabel } from "@/lib/social-media-type-label";

interface PersonDetailsProps {
	documentId: string;
	hasDraft: boolean;
	isLocaleFallback: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	selectedVersion: "draft" | "published";
	person: Pick<
		schema.Person,
		"email" | "id" | "name" | "orcid" | "sortName" | "imageCaption" | "imageCaptionMode"
	> & {
		biographyContentBlocks: Array<ContentBlock>;
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & { image: SelectedImage | null };
	contributions: Array<PersonContribution>;
	socialMedia: Array<PersonSocialMediaEntry>;
	/** Read-only lens: the edge is owned by the article, so it is not editable from here. */
	articles: Array<PersonArticle>;
	publishAction: (documentId: string) => Promise<unknown>;
	discardDraftAction?: (documentId: string) => Promise<unknown>;
}

export function PersonDetails(props: Readonly<PersonDetailsProps>): ReactNode {
	const {
		contributions,
		documentId,
		hasDraft,
		isLocaleFallback,
		isPublished,
		locales,
		person,
		publishAction,
		discardDraftAction,
		selectedLocaleCode,
		articles,
		socialMedia,
		selectedVersion,
	} = props;

	const t = useExtracted();

	const orcidUrl = getOrcidUrl(person.orcid);

	return (
		<Fragment>
			{isLocaleFallback ? (
				<Note intent="info">
					{t("Not yet translated in the selected language — showing the default language.")}
				</Note>
			) : null}
			<div className="flex items-center justify-between">
				<VersionSelector
					draftHref={`/dashboard/administrator/persons/${person.entityVersion.slug.value}/details`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishedHref={`/dashboard/administrator/persons/${person.entityVersion.slug.value}/details?version=published`}
					selectedVersion={selectedVersion}
				/>
				<div className="flex items-center gap-x-4">
					<EntityLifecycleBar
						discardDraftAction={discardDraftAction}
						documentId={documentId}
						editHref={`/dashboard/administrator/persons/${person.entityVersion.slug.value}/edit`}
						hasDraft={hasDraft}
						isPublished={isPublished}
						publishAction={publishAction}
					/>
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				</div>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Name")}</DescriptionTerm>
				<DescriptionDetails>{person.name}</DescriptionDetails>

				<DescriptionTerm>{t("Slug")}</DescriptionTerm>
				<DescriptionDetails>{person.entityVersion.slug.value}</DescriptionDetails>

				<DescriptionTerm>{t("Sort name")}</DescriptionTerm>
				<DescriptionDetails>{person.sortName}</DescriptionDetails>

				<DescriptionTerm>{t("Email")}</DescriptionTerm>
				<DescriptionDetails>{person.email}</DescriptionDetails>

				<DescriptionTerm>{t("ORCID")}</DescriptionTerm>
				<DescriptionDetails>
					{orcidUrl != null ? (
						<a className="underline" href={orcidUrl} rel="noreferrer" target="_blank">
							{person.orcid}
						</a>
					) : (
						person.orcid
					)}
				</DescriptionDetails>

				<DescriptionTerm>{t("Social media")}</DescriptionTerm>
				<DescriptionDetails>
					{socialMedia.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{socialMedia.map((entry) => (
								<li key={entry.url}>
									<span className="text-muted-fg">{getSocialMediaTypeLabel(entry.type)}</span>{" "}
									<a className="underline" href={entry.url} rel="noreferrer" target="_blank">
										{entry.label ?? entry.url}
									</a>
								</li>
							))}
						</ul>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Image")}</DescriptionTerm>
				<DescriptionDetails>
					{person.image != null ? (
						<FeaturedImageDetails
							image={person.image}
							imageCaption={person.imageCaption}
							imageCaptionMode={person.imageCaptionMode}
						/>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Relations")}</DescriptionTerm>
				<DescriptionDetails>
					{contributions.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{contributions.map((contribution) => (
								<RelationStatement
									key={contribution.id}
									duration={contribution.duration}
									relation={formatRoleType(contribution.roleType)}
									source={person.name}
									target={
										<Fragment>
											{contribution.organisationalUnitName}
											{contribution.organisationalUnitIsLocaleFallback ? (
												<LocaleFallbackMark />
											) : null}
										</Fragment>
									}
									targetHref={getOrganisationalUnitDetailHref(
										contribution.organisationalUnitType,
										contribution.organisationalUnitSlug,
									)}
									targetType={formatRoleType(contribution.organisationalUnitType)}
								/>
							))}
						</ul>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Articles")}</DescriptionTerm>
				<DescriptionDetails>
					{articles.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{articles.map((article) => (
								<RelationStatement
									key={`${article.entityType}-${article.documentId}`}
									relation={formatRoleType(article.role)}
									source={person.name}
									target={article.title}
									targetHref={getEntityDetailHref({
										entityType: article.entityType,
										slug: article.slug,
									})}
									targetType={getEntityTypeLabel({ entityType: article.entityType })}
								/>
							))}
						</ul>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Biography")}</DescriptionTerm>
				<DescriptionDetails>
					{person.biographyContentBlocks.length > 0 ? (
						<ContentBlocksView
							key={selectedVersion}
							contentBlocks={person.biographyContentBlocks}
						/>
					) : null}
				</DescriptionDetails>
			</DescriptionList>
		</Fragment>
	);
}
