"use client";

import type * as schema from "@dariah-eric/database/schema";
import { TabList, TabPanel } from "@dariah-eric/ui/tabs";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import {
	EntityEditTab,
	EntityEditTabs,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-edit-tabs";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { EntityRelationsFields } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-relations-fields";
import type { SelectedImage } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { PersonRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/person-relations-section";
import { UnitRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/unit-relations-section";
import { personRelationActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/admin-relation-actions";
import { WorkingGroupForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_components/working-group-form";
import { discardWorkingGroupDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_lib/discard-working-group-draft.action";
import { publishWorkingGroupAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_lib/publish-working-group.action";
import { updateWorkingGroupAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_lib/update-working-group.action";
import type { ContributionPersonOption } from "@/lib/data/contributions";
import type { PersonRelation, PersonRelationRoleOption } from "@/lib/data/person-relations";
import type { UnitRelation, UnitRelationStatusOption } from "@/lib/data/unit-relations";

interface WorkingGroupEditFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	documentId: string;
	hasDraftChanges: boolean;
	isDefaultLocale: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	workingGroup: Pick<
		schema.OrganisationalUnit,
		"acronym" | "email" | "id" | "mailingList" | "name" | "sshocMarketplaceActorId" | "summary"
	> & {
		descriptionContentBlocks?: Array<ContentBlock>;
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & { image: SelectedImage | null };
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
	relations: Array<UnitRelation>;
	unitRelationStatusOptions: Array<UnitRelationStatusOption>;
	personRelations: Array<PersonRelation>;
	personRelationRoleOptions: Array<PersonRelationRoleOption>;
	initialPersonItems: Array<ContributionPersonOption>;
	initialPersonTotal: number;
}

export function WorkingGroupEditForm(props: Readonly<WorkingGroupEditFormProps>): ReactNode {
	const {
		initialAssets,
		documentId,
		hasDraftChanges,
		isDefaultLocale,
		isPublished,
		locales,
		selectedLocaleCode,
		workingGroup,
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
		relations,
		unitRelationStatusOptions,
		personRelations,
		personRelationRoleOptions,
		initialPersonItems,
		initialPersonTotal,
	} = props;

	const t = useExtracted();
	const formId = "working-group-edit-form";

	return (
		<Fragment>
			<EntityFormHeader title={t("Edit working group")} />

			<EntityEditTabs defaultTab="details">
				<TabList aria-label={t("Edit working group")}>
					<EntityEditTab id="details">{t("Details")}</EntityEditTab>
					<EntityEditTab id="people">{t("People")}</EntityEditTab>
					<EntityEditTab id="relations">{t("Relations")}</EntityEditTab>
				</TabList>

				<TabPanel
					className="flex flex-col gap-y-(--layout-padding)"
					id="details"
					shouldPreserveState={true}
				>
					<div className="flex items-center justify-end gap-x-4">
						<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
						<EntityLifecycleBar
							discardDraftAction={discardWorkingGroupDraftAction}
							documentId={documentId}
							hasDraft={hasDraftChanges}
							isPublished={isPublished}
							publishAction={publishWorkingGroupAction}
						/>
					</div>

					<WorkingGroupForm
						key={workingGroup.id}
						formAction={updateWorkingGroupAction}
						formId={formId}
						initialAssets={initialAssets}
						initialSocialMediaIds={initialSocialMediaIds}
						initialSocialMediaItems={initialSocialMediaItems}
						initialSocialMediaTotal={initialSocialMediaTotal}
						isDefaultLocale={isDefaultLocale}
						isPublished={isPublished}
						selectedSocialMediaItems={selectedSocialMediaItems}
						workingGroup={workingGroup}
					>
						<EntityRelationsFields
							formId={formId}
							initialRelatedEntityIds={initialRelatedEntityIds}
							initialRelatedEntityItems={initialRelatedEntityItems}
							initialRelatedEntityTotal={initialRelatedEntityTotal}
							initialRelatedResourceIds={initialRelatedResourceIds}
							initialRelatedResourceItems={initialRelatedResourceItems}
							initialRelatedResourceTotal={initialRelatedResourceTotal}
							selectedRelatedEntities={selectedRelatedEntities}
							selectedRelatedResources={selectedRelatedResources}
						/>
					</WorkingGroupForm>
				</TabPanel>

				<TabPanel id="people" shouldPreserveState={true}>
					<PersonRelationsSection
						actions={personRelationActions}
						initialPersonItems={initialPersonItems}
						initialPersonTotal={initialPersonTotal}
						relations={personRelations}
						roleOptions={personRelationRoleOptions}
						organisationalUnitDocumentId={documentId}
					/>
				</TabPanel>

				<TabPanel id="relations" shouldPreserveState={true}>
					<UnitRelationsSection
						relations={relations}
						statusOptions={unitRelationStatusOptions}
						unitDocumentId={documentId}
					/>
				</TabPanel>
			</EntityEditTabs>
		</Fragment>
	);
}
