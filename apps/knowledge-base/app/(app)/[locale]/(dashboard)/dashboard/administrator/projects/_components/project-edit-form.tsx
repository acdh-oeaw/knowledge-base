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
import { ProjectForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-form";
import { ProjectPartnersSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-partners-section";
import { ProjectPersonsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-persons-section";
import { discardProjectDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/discard-project-draft.action";
import { publishProjectAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/publish-project.action";
import { updateProjectAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/update-project.action";

interface ProjectEditFormProps {
  initialAssets: Array<{ key: string; label: string; url: string }>;
  documentId: string;
  hasDraftChanges: boolean;
  isDefaultLocale: boolean;
  isPublished: boolean;
  locales: Array<{ code: string; name: string }>;
  selectedLocaleCode: string;
  project: Pick<
    schema.Project,
    "acronym" | "call" | "duration" | "funding" | "id" | "name" | "summary" | "topic"
  > & {
    descriptionContentBlocks?: Array<ContentBlock>;
    entityVersion: {
      entity: Pick<schema.Entity, "id">;
      slug: Pick<schema.Slug, "value">;
      status: Pick<schema.EntityStatus, "id" | "type">;
    };
    scope: Pick<schema.ProjectScope, "id" | "scope">;
  } & { image: { key: string; label: string; url: string } | null };
  scopes: Array<Pick<schema.ProjectScope, "id" | "scope">>;
  roles: Array<Pick<schema.ProjectRole, "id" | "role">>;
  initialSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
  initialSocialMediaTotal: number;
  selectedSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
  initialPartners: Array<{
    id: string;
    unitDocumentId: string;
    unitName: string;
    roleId: string;
    roleName: string;
    durationStart: Date | null;
    durationEnd: Date | null;
  }>;
  initialPersons: Array<{
    id: string;
    personDocumentId: string;
    personName: string;
    roleId: string;
    roleName: string;
    durationStart: Date | null;
    durationEnd: Date | null;
  }>;
  initialSocialMediaIds: Array<string>;
}

export function ProjectEditForm(props: Readonly<ProjectEditFormProps>): ReactNode {
  const {
    initialAssets,
    documentId,
    hasDraftChanges,
    isDefaultLocale,
    isPublished,
    locales,
    selectedLocaleCode,
    project,
    scopes,
    initialSocialMediaIds,
    initialSocialMediaItems,
    initialSocialMediaTotal,
    selectedSocialMediaItems,
    roles,
    initialPartners,
    initialPersons,
  } = props;

  const t = useExtracted();

  return (
    <Fragment>
      <EntityFormHeader title={t("Edit project")} />

      <EntityEditTabs defaultTab="details">
        <TabList aria-label={t("Edit project")}>
          <EntityEditTab id="details">{t("Details")}</EntityEditTab>
          <EntityEditTab id="project-partners">{t("Project partners")}</EntityEditTab>
        </TabList>

        <TabPanel
          className="flex flex-col gap-y-(--layout-padding)"
          id="details"
          shouldPreserveState={true}
        >
          <div className="flex items-center justify-end gap-x-4">
            <LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
            <EntityLifecycleBar
              discardDraftAction={discardProjectDraftAction}
              documentId={documentId}
              hasDraft={hasDraftChanges}
              isPublished={isPublished}
              publishAction={publishProjectAction}
            />
          </div>

          <ProjectForm
            key={project.id}
            formAction={updateProjectAction}
            initialAssets={initialAssets}
            initialSocialMediaIds={initialSocialMediaIds}
            initialSocialMediaItems={initialSocialMediaItems}
            initialSocialMediaTotal={initialSocialMediaTotal}
            isDefaultLocale={isDefaultLocale}
            project={project}
            scopes={scopes}
            selectedSocialMediaItems={selectedSocialMediaItems}
          />
        </TabPanel>

        <TabPanel id="project-partners" shouldPreserveState={true}>
          <ProjectPartnersSection
            partners={initialPartners}
            projectDocumentId={documentId}
            roles={roles}
          />
        </TabPanel>
        <TabPanel id="project-persons" shouldPreserveState={true}>
          <ProjectPersonsSection
            persons={initialPersons}
            projectDocumentId={documentId}
            roles={roles}
          />
        </TabPanel>
      </EntityEditTabs>
    </Fragment>
  );
}
