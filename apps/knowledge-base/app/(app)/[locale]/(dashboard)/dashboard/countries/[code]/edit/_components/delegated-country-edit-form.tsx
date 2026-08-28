"use client";

import { TabList, TabPanel } from "@dariah-eric/ui/tabs";
import { useExtracted } from "next-intl";
import { type ComponentProps, Fragment, type ReactNode } from "react";

import {
	EntityEditTab,
	EntityEditTabs,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-edit-tabs";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { PersonRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/person-relations-section";
import { ReverseUnitRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/reverse-unit-relations-section";
import { createDelegatedPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/create-delegated-person.action";
import { getDelegatedPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/get-delegated-person.action";
import { updateDelegatedPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/update-delegated-person.action";
import { personRelationActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/admin-relation-actions";
import { NationalConsortiumForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/national-consortia/_components/national-consortium-form";
import { createDelegatedInstitutionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/create-delegated-institution.action";
import { delegatedUnitRelationActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/delegated-unit-relation-actions";
import { getDelegatedInstitutionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/get-delegated-institution.action";
import { updateDelegatedInstitutionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/update-delegated-institution.action";
import { updateDelegatedNationalConsortiumAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/update-national-consortium.action";
import type { ContributionPersonOption } from "@/lib/data/contributions";
import type { PersonRelation, PersonRelationRoleOption } from "@/lib/data/person-relations";
import type { ReverseUnitRelation, UnitRelationStatusOption } from "@/lib/data/unit-relations";

interface DelegatedCountryEditFormProps {
	documentId: string;
	hasDraftChanges: boolean;
	initialAssets: ComponentProps<typeof NationalConsortiumForm>["initialAssets"];
	isDefaultLocale: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	nationalConsortium: ComponentProps<typeof NationalConsortiumForm>["nationalConsortium"];
	initialSocialMediaIds: Array<string>;
	initialSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal: number;
	selectedSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	/** Country document id — the target of the country people and the scope of the institution picker. */
	countryDocumentId: string;
	personRelations: Array<PersonRelation>;
	personRelationRoleOptions: Array<PersonRelationRoleOption>;
	initialPersonItems: Array<ContributionPersonOption>;
	initialPersonTotal: number;
	/** DARIAH ERIC document id, the fixed target of the partner-institution relations. */
	ericDocumentId: string | null;
	ericInstitutionRelations: Array<ReverseUnitRelation>;
	ericInstitutionStatusOptions: Array<UnitRelationStatusOption>;
}

/**
 * Non-admin counterpart of `NationalConsortiumEditForm` + the country institutions/people tabs. The
 * Details tab edits the national consortium (saved as a draft; publishing remains admin-only),
 * while the People and Institutions tabs manage relations on the country document the coordinator
 * is scoped to.
 */
export function DelegatedCountryEditForm(
	props: Readonly<DelegatedCountryEditFormProps>,
): ReactNode {
	const {
		initialAssets,
		isDefaultLocale,
		isPublished,
		locales,
		selectedLocaleCode,
		nationalConsortium,
		initialSocialMediaIds,
		initialSocialMediaItems,
		initialSocialMediaTotal,
		selectedSocialMediaItems,
		countryDocumentId,
		personRelations,
		personRelationRoleOptions,
		initialPersonItems,
		initialPersonTotal,
		ericDocumentId,
		ericInstitutionRelations,
		ericInstitutionStatusOptions,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("Edit national consortium")} />

			<EntityEditTabs defaultTab="details">
				<TabList aria-label={t("Edit national consortium")}>
					<EntityEditTab id="details">{t("Details")}</EntityEditTab>
					<EntityEditTab id="people">{t("People")}</EntityEditTab>
					<EntityEditTab id="institutions">{t("Institutions")}</EntityEditTab>
				</TabList>

				<TabPanel
					className="flex flex-col gap-y-(--layout-padding)"
					id="details"
					shouldPreserveState={true}
				>
					<div className="flex justify-end">
						<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
					</div>

					<NationalConsortiumForm
						formAction={updateDelegatedNationalConsortiumAction}
						formId="delegated-national-consortium-edit-form"
						initialAssets={initialAssets}
						initialSocialMediaIds={initialSocialMediaIds}
						initialSocialMediaItems={initialSocialMediaItems}
						initialSocialMediaTotal={initialSocialMediaTotal}
						isDefaultLocale={isDefaultLocale}
						isPublished={isPublished}
						nationalConsortium={nationalConsortium}
						selectedSocialMediaItems={selectedSocialMediaItems}
						showSaveAndPublish={false}
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
						organisationalUnitDocumentId={countryDocumentId}
						relations={personRelations}
						roleOptions={personRelationRoleOptions}
					/>
				</TabPanel>

				<TabPanel
					className="flex flex-col gap-y-(--layout-padding)"
					id="institutions"
					shouldPreserveState={true}
				>
					{ericDocumentId != null ? (
						<ReverseUnitRelationsSection
							actions={delegatedUnitRelationActions}
							createSourceUnit={{
								action: createDelegatedInstitutionAction,
								scopeDocumentId: countryDocumentId,
								buttonLabel: t("Add new institution"),
								title: t("Add new institution"),
							}}
							editSourceUnit={{
								updateAction: updateDelegatedInstitutionAction,
								getFields: getDelegatedInstitutionAction,
								rowActionLabel: t("Edit institution"),
								title: t("Edit institution"),
							}}
							includeDraftSourceUnits={true}
							messages={{
								title: t("Institutions"),
								memberLabel: t("Institution"),
								empty: t("No institutions."),
								addButton: t("Add institution"),
							}}
							relatedUnitDocumentId={ericDocumentId}
							relations={ericInstitutionRelations}
							sourceUnitLocatedInCountryDocumentId={countryDocumentId}
							sourceUnitType="institution"
							statusOptions={ericInstitutionStatusOptions}
						/>
					) : (
						<p className="text-sm text-neutral-500">
							{t("DARIAH ERIC is not available, so institution relations cannot be managed.")}
						</p>
					)}
				</TabPanel>
			</EntityEditTabs>
		</Fragment>
	);
}
