"use client";

import { TabList, TabPanel } from "@dariah-eric/ui/tabs";
import { useExtracted } from "next-intl";
import { type ComponentProps, Fragment, type ReactNode } from "react";

import {
	EntityEditTab,
	EntityEditTabs,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-edit-tabs";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { PersonRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/person-relations-section";
import { createDelegatedPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/create-delegated-person.action";
import { getDelegatedPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/get-delegated-person.action";
import { updateDelegatedPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/update-delegated-person.action";
import { personRelationActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/admin-relation-actions";
import { WorkingGroupForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_components/working-group-form";
import { updateDelegatedWorkingGroupAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/working-groups/[slug]/edit/_lib/update-working-group.action";
import type { ContributionPersonOption } from "@/lib/data/contributions";
import type { PersonRelation, PersonRelationRoleOption } from "@/lib/data/person-relations";

interface DelegatedWorkingGroupEditFormProps {
	initialAssets: ComponentProps<typeof WorkingGroupForm>["initialAssets"];
	workingGroup: ComponentProps<typeof WorkingGroupForm>["workingGroup"];
	documentId: string;
	hasDraftChanges: boolean;
	isDefaultLocale: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	initialSocialMediaIds: Array<string>;
	initialSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal: number;
	selectedSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	personRelations: Array<PersonRelation>;
	personRelationRoleOptions: Array<PersonRelationRoleOption>;
	initialPersonItems: Array<ContributionPersonOption>;
	initialPersonTotal: number;
}

/**
 * Non-admin counterpart of `WorkingGroupEditForm`. Working-group chairs edit the group's details
 * (saved as a draft; publishing remains admin-only) and manage its people via the shared,
 * scope-authorized sections.
 */
export function DelegatedWorkingGroupEditForm(
	props: Readonly<DelegatedWorkingGroupEditFormProps>,
): ReactNode {
	const {
		initialAssets,
		workingGroup,
		documentId,
		hasDraftChanges,
		isDefaultLocale,
		isPublished,
		locales,
		selectedLocaleCode,
		initialSocialMediaIds,
		initialSocialMediaItems,
		initialSocialMediaTotal,
		selectedSocialMediaItems,
		personRelations,
		personRelationRoleOptions,
		initialPersonItems,
		initialPersonTotal,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("Edit working group")} />

			<EntityEditTabs defaultTab="details">
				<TabList aria-label={t("Edit working group")}>
					<EntityEditTab id="details">{t("Details")}</EntityEditTab>
					<EntityEditTab id="people">{t("People")}</EntityEditTab>
				</TabList>

				<TabPanel
					className="flex flex-col gap-y-(--layout-padding)"
					id="details"
					shouldPreserveState={true}
				>
					<div className="flex items-center justify-end gap-x-4">
						<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
						<EntityLifecycleBar
							documentId={documentId}
							hasDraft={hasDraftChanges}
							isPublished={isPublished}
						/>
					</div>

					<WorkingGroupForm
						formAction={updateDelegatedWorkingGroupAction}
						formId="delegated-working-group-edit-form"
						initialAssets={initialAssets}
						initialSocialMediaIds={initialSocialMediaIds}
						initialSocialMediaItems={initialSocialMediaItems}
						initialSocialMediaTotal={initialSocialMediaTotal}
						isDefaultLocale={isDefaultLocale}
						isPublished={isPublished}
						selectedSocialMediaItems={selectedSocialMediaItems}
						showSaveAndPublish={false}
						workingGroup={workingGroup}
					/>
				</TabPanel>

				<TabPanel id="people" shouldPreserveState={true}>
					<PersonRelationsSection
						actions={personRelationActions}
						createPersonAction={createDelegatedPersonAction}
						includeDraftPersons={true}
						personEditor={{
							updateAction: updateDelegatedPersonAction,
							getFields: getDelegatedPersonAction,
							rowActionLabel: t("Edit person"),
							title: t("Edit person"),
						}}
						initialPersonItems={initialPersonItems}
						initialPersonTotal={initialPersonTotal}
						organisationalUnitDocumentId={documentId}
						relations={personRelations}
						roleOptions={personRelationRoleOptions}
					/>
				</TabPanel>
			</EntityEditTabs>
		</Fragment>
	);
}
