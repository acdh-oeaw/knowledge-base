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
import { LocaleFallbackMark } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-fallback-mark";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { RelationLink } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-link";
import { RelationStatement } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-statement";
import { RelationTypeSuffix } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-type-suffix";
import { VersionSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/version-selector";
import type { PersonRelation } from "@/lib/data/person-relations";
import type { UnitRelation } from "@/lib/data/unit-relations";
import { getEntityDetailHref, getOrganisationalUnitDetailHref } from "@/lib/entity-detail-href";
import { formatRoleType } from "@/lib/format-role-type";

interface WorkingGroupDetailsProps {
	documentId: string;
	hasDraft: boolean;
	isLocaleFallback: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	selectedVersion: "draft" | "published";
	workingGroup: Pick<
		schema.OrganisationalUnit,
		"acronym" | "email" | "id" | "mailingList" | "name" | "sshocMarketplaceActorId" | "summary"
	> & {
		descriptionContentBlocks: Array<ContentBlock>;
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & { image: SelectedImage | null };
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
	publishAction?: (documentId: string) => Promise<unknown>;
	discardDraftAction?: (documentId: string) => Promise<unknown>;
	detailHref?: string;
	editHref?: string | null;
	enableAdminEntityLinks?: boolean;
}

export function WorkingGroupDetails(props: Readonly<WorkingGroupDetailsProps>): ReactNode {
	const {
		documentId,
		hasDraft,
		isLocaleFallback,
		isPublished,
		locales,
		workingGroup,
		personRelations,
		relations,
		publishAction,
		discardDraftAction,
		selectedLocaleCode,
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedSocialMediaItems,
		selectedVersion,
		enableAdminEntityLinks,
	} = props;

	const t = useExtracted();

	const mailingListIsUrl =
		workingGroup.mailingList != null && URL.canParse(workingGroup.mailingList);

	return (
		<Fragment>
			{isLocaleFallback ? (
				<Note intent="info">
					{t("Not yet translated in the selected language — showing the default language.")}
				</Note>
			) : null}
			<div className="flex items-center justify-between">
				<VersionSelector
					draftHref={`/dashboard/administrator/working-groups/${workingGroup.entityVersion.slug.value}/details`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishedHref={`/dashboard/administrator/working-groups/${workingGroup.entityVersion.slug.value}/details?version=published`}
					selectedVersion={selectedVersion}
				/>
				<div className="flex items-center gap-x-4">
					<EntityLifecycleBar
						discardDraftAction={discardDraftAction}
						documentId={documentId}
						editHref={`/dashboard/administrator/working-groups/${workingGroup.entityVersion.slug.value}/edit`}
						hasDraft={hasDraft}
						isPublished={isPublished}
						publishAction={publishAction}
					/>
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				</div>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Name")}</DescriptionTerm>
				<DescriptionDetails>{workingGroup.name}</DescriptionDetails>

				<DescriptionTerm>{t("Slug")}</DescriptionTerm>
				<DescriptionDetails>{workingGroup.entityVersion.slug.value}</DescriptionDetails>

				<DescriptionTerm>{t("Acronym")}</DescriptionTerm>
				<DescriptionDetails>{workingGroup.acronym}</DescriptionDetails>

				<DescriptionTerm>{t("SSHOC actor ID")}</DescriptionTerm>
				<DescriptionDetails>{workingGroup.sshocMarketplaceActorId}</DescriptionDetails>

				<DescriptionTerm>{t("Summary")}</DescriptionTerm>
				<DescriptionDetails>{workingGroup.summary}</DescriptionDetails>

				<DescriptionTerm>{t("Image")}</DescriptionTerm>
				<DescriptionDetails>
					{workingGroup.image != null ? (
						<img
							alt=""
							className="rounded-lg object-contain block-24 inline-auto max-inline-full"
							src={workingGroup.image.url}
						/>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Description")}</DescriptionTerm>
				<DescriptionDetails>
					{workingGroup.descriptionContentBlocks.length > 0 ? (
						<ContentBlocksView
							key={selectedVersion}
							contentBlocks={workingGroup.descriptionContentBlocks}
						/>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Email")}</DescriptionTerm>
				<DescriptionDetails>
					{workingGroup.email != null ? (
						<a className="underline" href={`mailto:${workingGroup.email}`}>
							{workingGroup.email}
						</a>
					) : null}
				</DescriptionDetails>

				<DescriptionTerm>{t("Mailing list")}</DescriptionTerm>
				<DescriptionDetails>
					{workingGroup.mailingList != null ? (
						<a
							className="underline"
							href={
								mailingListIsUrl ? workingGroup.mailingList : `mailto:${workingGroup.mailingList}`
							}
							rel={mailingListIsUrl ? "noreferrer" : undefined}
							target={mailingListIsUrl ? "_blank" : undefined}
						>
							{workingGroup.mailingList}
						</a>
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
									{enableAdminEntityLinks ? (
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
									) : (
										<span className="font-medium">{relatedEntity.name}</span>
									)}
									<RelationTypeSuffix type={relatedEntity.description} />
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
									<RelationTypeSuffix type={relatedResource.description} />
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
									sourceHref={
										enableAdminEntityLinks
											? getEntityDetailHref({
													entityType: "persons",
													slug: relation.personSlug,
												})
											: undefined
									}
									relation={formatRoleType(relation.roleType)}
									target={workingGroup.name}
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
									source={workingGroup.name}
									relation={formatRoleType(relation.statusType)}
									target={
										<Fragment>
											{relation.relatedUnitName}
											{relation.relatedUnitIsLocaleFallback ? <LocaleFallbackMark /> : null}
										</Fragment>
									}
									targetHref={
										enableAdminEntityLinks
											? getOrganisationalUnitDetailHref(
													relation.relatedUnitType,
													relation.relatedUnitSlug,
												)
											: undefined
									}
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
