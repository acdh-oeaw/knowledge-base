"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@acdh-knowledge-base/ui/description-list";
import { Note } from "@acdh-knowledge-base/ui/note";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { LocaleFallbackMark } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-fallback-mark";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { RelationLink } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-link";
import { RelationStatement } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-statement";
import { VersionSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/version-selector";
import type { PersonRelation } from "@/lib/data/person-relations";
import type { UnitRelation } from "@/lib/data/unit-relations";
import { getEntityDetailHref, getOrganisationalUnitDetailHref } from "@/lib/entity-detail-href";
import { formatRoleType } from "@/lib/format-role-type";

interface GovernanceBodyDetailsProps {
	documentId: string;
	hasDraft: boolean;
	isLocaleFallback: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	selectedVersion: "draft" | "published";
	governanceBody: Pick<schema.OrganisationalUnit, "acronym" | "id" | "name" | "summary"> & {
		descriptionContentBlocks: Array<ContentBlock>;
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & { image: { key: string; label: string; url: string } | null };
	selectedRelatedEntities: Array<{
		id: string;
		name: string;
		description?: string;
		slug: string;
		entityType: string;
		unitType: string | null;
	}>;
	selectedRelatedResources: Array<{ id: string; name: string; description?: string }>;
	selectedSocialMediaItems: Array<{
		id: string;
		name: string;
		type?: string;
		url?: string;
		description?: string;
	}>;
	personRelations: Array<PersonRelation>;
	relations: Array<UnitRelation>;
	publishAction: (documentId: string) => Promise<unknown>;
	discardDraftAction?: (documentId: string) => Promise<unknown>;
}

export function GovernanceBodyDetails(props: Readonly<GovernanceBodyDetailsProps>): ReactNode {
	const {
		documentId,
		hasDraft,
		isLocaleFallback,
		isPublished,
		governanceBody,
		locales,
		personRelations,
		relations,
		publishAction,
		discardDraftAction,
		selectedLocaleCode,
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedSocialMediaItems,
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
					draftHref={`/dashboard/administrator/governance-bodies/${governanceBody.entityVersion.slug.value}/details`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishedHref={`/dashboard/administrator/governance-bodies/${governanceBody.entityVersion.slug.value}/details?version=published`}
					selectedVersion={selectedVersion}
				/>
				<div className="flex items-center gap-x-4">
					<EntityLifecycleBar
						discardDraftAction={discardDraftAction}
						documentId={documentId}
						editHref={`/dashboard/administrator/governance-bodies/${governanceBody.entityVersion.slug.value}/edit`}
						hasDraft={hasDraft}
						isPublished={isPublished}
						publishAction={publishAction}
					/>
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				</div>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Name")}</DescriptionTerm>
				<DescriptionDetails>{governanceBody.name}</DescriptionDetails>

				<DescriptionTerm>{t("Slug")}</DescriptionTerm>
				<DescriptionDetails>{governanceBody.entityVersion.slug.value}</DescriptionDetails>

				<DescriptionTerm>{t("Acronym")}</DescriptionTerm>
				<DescriptionDetails>{governanceBody.acronym}</DescriptionDetails>

				<DescriptionTerm>{t("Summary")}</DescriptionTerm>
				<DescriptionDetails>{governanceBody.summary}</DescriptionDetails>

				<DescriptionTerm>{t("Image")}</DescriptionTerm>
				<DescriptionDetails>
					{governanceBody.image != null ? (
						<img
							alt=""
							className="block-24 inline-auto max-inline-full rounded-lg object-contain"
							src={governanceBody.image.url}
						/>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Description")}</DescriptionTerm>
				<DescriptionDetails>
					{governanceBody.descriptionContentBlocks.length > 0 ? (
						<ContentBlocksView
							key={selectedVersion}
							contentBlocks={governanceBody.descriptionContentBlocks}
						/>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Social Media")}</DescriptionTerm>
				<DescriptionDetails>
					{selectedSocialMediaItems.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{selectedSocialMediaItems.map((socialMediaItem) => (
								<li key={socialMediaItem.id} className="text-sm">
									<span className="font-medium">{socialMediaItem.name}</span>
									{socialMediaItem.type != null ? (
										<Fragment>
											{" · "}
											<span className="text-muted-fg">{socialMediaItem.type}</span>
										</Fragment>
									) : null}
									{socialMediaItem.url != null ? (
										<Fragment>
											{" · "}
											<a
												className="underline"
												href={socialMediaItem.url}
												rel="noreferrer"
												target="_blank"
											>
												{socialMediaItem.url}
											</a>
										</Fragment>
									) : null}
								</li>
							))}
						</ul>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Related entities")}</DescriptionTerm>
				<DescriptionDetails>
					{selectedRelatedEntities.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{selectedRelatedEntities.map((relatedEntity) => (
								<li key={relatedEntity.id} className="text-sm">
									<RelationLink
										className="font-medium"
										href={getEntityDetailHref({
											entityType: relatedEntity.entityType,
											slug: relatedEntity.slug,
											unitType: relatedEntity.unitType,
										})}
									>
										{relatedEntity.name}
									</RelationLink>
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

				<DescriptionTerm>{t("People")}</DescriptionTerm>
				<DescriptionDetails>
					{personRelations.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{personRelations.map((relation) => (
								<RelationStatement
									key={relation.id}
									source={relation.personName}
									sourceHref={getEntityDetailHref({
										entityType: "persons",
										slug: relation.personSlug,
									})}
									relation={formatRoleType(relation.roleType)}
									target={governanceBody.name}
									targetType={formatRoleType(relation.targetUnitType)}
									duration={relation.duration}
								/>
							))}
						</ul>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Relations")}</DescriptionTerm>
				<DescriptionDetails>
					{relations.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{relations.map((relation) => (
								<RelationStatement
									key={relation.id}
									source={governanceBody.name}
									relation={formatRoleType(relation.statusType)}
									target={
										<Fragment>
											{relation.relatedUnitName}
											{relation.relatedUnitIsLocaleFallback ? <LocaleFallbackMark /> : null}
										</Fragment>
									}
									targetHref={getOrganisationalUnitDetailHref(
										relation.relatedUnitType,
										relation.relatedUnitSlug,
									)}
									targetType={formatRoleType(relation.relatedUnitType)}
									duration={relation.duration}
								/>
							))}
						</ul>
					) : null}
				</DescriptionDetails>
			</DescriptionList>
		</Fragment>
	);
}
