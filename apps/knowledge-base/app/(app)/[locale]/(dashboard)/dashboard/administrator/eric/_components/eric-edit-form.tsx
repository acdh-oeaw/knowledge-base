"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { TabList, TabPanel } from "@acdh-knowledge-base/ui/tabs";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import {
	EntityEditTab,
	EntityEditTabs,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-edit-tabs";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { ReverseUnitRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/reverse-unit-relations-section";
import { EricForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/eric/_components/eric-form";
import { discardEricDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/eric/_lib/discard-eric-draft.action";
import { publishEricAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/eric/_lib/publish-eric.action";
import { updateEricAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/eric/_lib/update-eric.action";
import type { EricReverseRelationGroups } from "@/lib/data/eric";

interface EricEditFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	documentId: string;
	hasDraftChanges: boolean;
	isPublished: boolean;
	eric: Pick<
		schema.OrganisationalUnit,
		"acronym" | "id" | "name" | "ror" | "sshocMarketplaceActorId" | "summary"
	> & {
		descriptionContentBlocks?: Array<ContentBlock>;
		entityVersion: { entity: { id: string; slug: string } };
	} & { image: { key: string; label: string; url: string } | null };
	initialRelatedEntityIds: Array<string>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceIds: Array<string>;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
	initialSocialMediaIds: Array<string>;
	initialSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal: number;
	selectedRelatedEntities: Array<{ id: string; name: string; description?: string }>;
	selectedRelatedResources: Array<{ id: string; name: string; description?: string }>;
	selectedSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	reverseRelationGroups: EricReverseRelationGroups;
}

export function EricEditForm(props: Readonly<EricEditFormProps>): ReactNode {
	const {
		initialAssets,
		documentId,
		hasDraftChanges,
		isPublished,
		eric,
		initialRelatedEntityIds,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceIds,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		initialSocialMediaIds,
		initialSocialMediaItems,
		initialSocialMediaTotal,
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedSocialMediaItems,
		reverseRelationGroups,
	} = props;

	const t = useExtracted();
	const formId = "eric-edit-form";

	return (
		<Fragment>
			<EntityFormHeader title={t("Edit DARIAH ERIC")} />

			<EntityEditTabs defaultTab="details">
				<TabList aria-label={t("Edit DARIAH ERIC")}>
					<EntityEditTab id="details">{t("Details")}</EntityEditTab>
					<EntityEditTab id="countries">{t("Countries")}</EntityEditTab>
					<EntityEditTab id="institutions">{t("Institutions")}</EntityEditTab>
					<EntityEditTab id="working-groups">{t("Working groups")}</EntityEditTab>
					<EntityEditTab id="governance-bodies">{t("Governance bodies")}</EntityEditTab>
				</TabList>

				<TabPanel
					className="flex flex-col gap-y-(--layout-padding)"
					id="details"
					shouldPreserveState={true}
				>
					<div className="flex justify-end">
						<EntityLifecycleBar
							discardDraftAction={discardEricDraftAction}
							documentId={documentId}
							hasDraft={hasDraftChanges}
							isPublished={isPublished}
							publishAction={publishEricAction}
						/>
					</div>

					<EricForm
						eric={eric}
						formAction={updateEricAction}
						formId={formId}
						initialAssets={initialAssets}
						initialRelatedEntityIds={initialRelatedEntityIds}
						initialRelatedEntityItems={initialRelatedEntityItems}
						initialRelatedEntityTotal={initialRelatedEntityTotal}
						initialRelatedResourceIds={initialRelatedResourceIds}
						initialRelatedResourceItems={initialRelatedResourceItems}
						initialRelatedResourceTotal={initialRelatedResourceTotal}
						initialSocialMediaIds={initialSocialMediaIds}
						initialSocialMediaItems={initialSocialMediaItems}
						initialSocialMediaTotal={initialSocialMediaTotal}
						selectedRelatedEntities={selectedRelatedEntities}
						selectedRelatedResources={selectedRelatedResources}
						selectedSocialMediaItems={selectedSocialMediaItems}
						showSaveAndPublish={true}
					/>
				</TabPanel>

				<TabPanel id="countries" shouldPreserveState={true}>
					<ReverseUnitRelationsSection
						messages={{
							title: t("Countries"),
							memberLabel: t("Country"),
							empty: t("No countries."),
							addButton: t("Add country"),
						}}
						relatedUnitDocumentId={documentId}
						relations={reverseRelationGroups.country.relations}
						sourceUnitType="country"
						statusOptions={reverseRelationGroups.country.statusOptions}
					/>
				</TabPanel>

				<TabPanel id="institutions" shouldPreserveState={true}>
					<ReverseUnitRelationsSection
						messages={{
							title: t("Institutions"),
							memberLabel: t("Institution"),
							empty: t("No institutions."),
							addButton: t("Add institution"),
						}}
						relatedUnitDocumentId={documentId}
						relations={reverseRelationGroups.institution.relations}
						sourceUnitType="institution"
						statusOptions={reverseRelationGroups.institution.statusOptions}
					/>
				</TabPanel>

				<TabPanel id="working-groups" shouldPreserveState={true}>
					<ReverseUnitRelationsSection
						messages={{
							title: t("Working groups"),
							memberLabel: t("Working group"),
							empty: t("No working groups."),
							addButton: t("Add working group"),
						}}
						relatedUnitDocumentId={documentId}
						relations={reverseRelationGroups.working_group.relations}
						sourceUnitType="working_group"
						statusOptions={reverseRelationGroups.working_group.statusOptions}
					/>
				</TabPanel>

				<TabPanel id="governance-bodies" shouldPreserveState={true}>
					<ReverseUnitRelationsSection
						messages={{
							title: t("Governance bodies"),
							memberLabel: t("Governance body"),
							empty: t("No governance bodies."),
							addButton: t("Add governance body"),
						}}
						relatedUnitDocumentId={documentId}
						relations={reverseRelationGroups.governance_body.relations}
						sourceUnitType="governance_body"
						statusOptions={reverseRelationGroups.governance_body.statusOptions}
					/>
				</TabPanel>
			</EntityEditTabs>
		</Fragment>
	);
}
