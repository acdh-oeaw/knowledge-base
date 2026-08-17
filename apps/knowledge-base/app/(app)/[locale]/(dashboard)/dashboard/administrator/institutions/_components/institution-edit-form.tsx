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
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { PersonRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/person-relations-section";
import {
  type UnitProject,
  UnitProjectsSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/unit-projects-section";
import { UnitRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/unit-relations-section";
import { InstitutionForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/institutions/_components/institution-form";
import { discardInstitutionDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/institutions/_lib/discard-institution-draft.action";
import { publishInstitutionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/institutions/_lib/publish-institution.action";
import { updateInstitutionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/institutions/_lib/update-institution.action";
import type { ContributionPersonOption } from "@/lib/data/contributions";
import type { PersonRelation, PersonRelationRoleOption } from "@/lib/data/person-relations";
import type { UnitRelation, UnitRelationStatusOption } from "@/lib/data/unit-relations";

interface InstitutionEditFormProps {
  initialAssets: Array<{ key: string; label: string; url: string }>;
  documentId: string;
  hasDraftChanges: boolean;
  isDefaultLocale: boolean;
  isPublished: boolean;
  locales: Array<{ code: string; name: string }>;
  selectedLocaleCode: string;
  institution: Pick<
    schema.OrganisationalUnit,
    "acronym" | "id" | "name" | "ror" | "sshocMarketplaceActorId" | "summary"
  > & {
    descriptionContentBlocks?: Array<ContentBlock>;
    entityVersion: { entity: { id: string }; slug: { value: string } };
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
  personRelations: Array<PersonRelation>;
  personRelationRoleOptions: Array<PersonRelationRoleOption>;
  initialPersonItems: Array<ContributionPersonOption>;
  initialPersonTotal: number;
  relations: Array<UnitRelation>;
  unitRelationStatusOptions: Array<UnitRelationStatusOption>;
  projects: Array<UnitProject>;
  projectRoles: Array<{ id: string; role: string }>;
}

export function InstitutionEditForm(props: Readonly<InstitutionEditFormProps>): ReactNode {
  const {
    initialAssets,
    documentId,
    hasDraftChanges,
    isDefaultLocale,
    isPublished,
    locales,
    selectedLocaleCode,
    institution,
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
    personRelations,
    personRelationRoleOptions,
    initialPersonItems,
    initialPersonTotal,
    relations,
    unitRelationStatusOptions,
    projects,
    projectRoles,
  } = props;

  const t = useExtracted();
  const formId = "institution-edit-form";

  return (
    <Fragment>
      <EntityFormHeader title={t("Edit institution")} />

      <EntityEditTabs defaultTab="details">
        <TabList aria-label={t("Edit institution")}>
          <EntityEditTab id="details">{t("Details")}</EntityEditTab>
          <EntityEditTab id="people">{t("People")}</EntityEditTab>
          <EntityEditTab id="relations">{t("Relations")}</EntityEditTab>
          <EntityEditTab id="projects">{t("Projects")}</EntityEditTab>
        </TabList>

        <TabPanel
          className="flex flex-col gap-y-(--layout-padding)"
          id="details"
          shouldPreserveState={true}
        >
          <div className="flex items-center justify-end gap-x-4">
            <LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
            <EntityLifecycleBar
              discardDraftAction={discardInstitutionDraftAction}
              documentId={documentId}
              hasDraft={hasDraftChanges}
              isPublished={isPublished}
              publishAction={publishInstitutionAction}
            />
          </div>

          <InstitutionForm
            key={institution.id}
            formAction={updateInstitutionAction}
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
            institution={institution}
            isDefaultLocale={isDefaultLocale}
            selectedRelatedEntities={selectedRelatedEntities}
            selectedRelatedResources={selectedRelatedResources}
            selectedSocialMediaItems={selectedSocialMediaItems}
          />
        </TabPanel>

        <TabPanel id="people" shouldPreserveState={true}>
          <PersonRelationsSection
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

        <TabPanel id="projects" shouldPreserveState={true}>
          <UnitProjectsSection
            projects={projects}
            roles={projectRoles}
            unitDocumentId={documentId}
          />
        </TabPanel>
      </EntityEditTabs>
    </Fragment>
  );
}
