"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@acdh-knowledge-base/ui/description-list";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { RelationStatement } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-statement";
import { VersionSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/version-selector";
import type { PersonContribution } from "@/lib/data/contributions";
import { getOrganisationalUnitDetailHref } from "@/lib/entity-detail-href";
import { formatRoleType } from "@/lib/format-role-type";

interface PersonDetailsProps {
	documentId: string;
	hasDraft: boolean;
	isPublished: boolean;
	selectedVersion: "draft" | "published";
	person: Pick<schema.Person, "email" | "id" | "name" | "orcid" | "sortName"> & {
		biographyContentBlocks: Array<ContentBlock>;
		entityVersion: { entity: { id: string; slug: string } };
		socialMedia: Array<{
			id: string;
			name: string;
			url: string;
			type: { type: string };
		}>;
	} & { image: { key: string; label: string; url: string } | null };
	contributions: Array<PersonContribution>;
	publishAction: (documentId: string) => Promise<unknown>;
	discardDraftAction?: (documentId: string) => Promise<unknown>;
}

export function PersonDetails(props: Readonly<PersonDetailsProps>): ReactNode {
	const {
		contributions,
		documentId,
		hasDraft,
		isPublished,
		person,
		publishAction,
		discardDraftAction,
		selectedVersion,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<div className="flex items-center justify-between">
				<VersionSelector
					draftHref={`/dashboard/administrator/persons/${person.entityVersion.entity.slug}/details`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishedHref={`/dashboard/administrator/persons/${person.entityVersion.entity.slug}/details?version=published`}
					selectedVersion={selectedVersion}
				/>
				<EntityLifecycleBar
					discardDraftAction={discardDraftAction}
					documentId={documentId}
					editHref={`/dashboard/administrator/persons/${person.entityVersion.entity.slug}/edit`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishAction={publishAction}
				/>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Name")}</DescriptionTerm>
				<DescriptionDetails>{person.name}</DescriptionDetails>

				<DescriptionTerm>{t("Slug")}</DescriptionTerm>
				<DescriptionDetails>{person.entityVersion.entity.slug}</DescriptionDetails>

				<DescriptionTerm>{t("Sort name")}</DescriptionTerm>
				<DescriptionDetails>{person.sortName}</DescriptionDetails>

				<DescriptionTerm>{t("Email")}</DescriptionTerm>
				<DescriptionDetails>{person.email}</DescriptionDetails>

				<DescriptionTerm>{t("ORCID")}</DescriptionTerm>
				<DescriptionDetails>{person.orcid}</DescriptionDetails>

				<DescriptionTerm>{t("Image")}</DescriptionTerm>
				<DescriptionDetails>
					{person.image != null ? (
						<img
							alt=""
							className="block-24 inline-auto max-inline-full rounded-lg object-contain"
							src={person.image.url}
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
									target={contribution.organisationalUnitName}
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

				<DescriptionTerm>{t("Biography")}</DescriptionTerm>
				<DescriptionDetails>
					{person.biographyContentBlocks.length > 0 ? (
						<ContentBlocksView
							key={selectedVersion}
							contentBlocks={person.biographyContentBlocks}
						/>
					) : null}
				</DescriptionDetails>
				<DescriptionTerm>{t("Social media")}</DescriptionTerm>
				<DescriptionDetails>
					{person.socialMedia.length > 0 ? (
						<ul className="flex flex-col gap-1">
							{person.socialMedia.map((item) => (
								<li key={item.id} className="text-sm">
									<span className="font-medium">{item.name}</span>
									{" · "}
									<span className="text-muted-fg">{item.type.type}</span>
									{" · "}
									<a className="underline" href={item.url} rel="noreferrer" target="_blank">
										{item.url}
									</a>
								</li>
							))}
						</ul>
					) : null}
				</DescriptionDetails>
			</DescriptionList>
		</Fragment>
	);
}
