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
import type { SelectedImage } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { ProjectAffiliationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-affiliations-section";
import { ProjectForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-form";
import { ProjectPartnersSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-partners-section";
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
		"acronym" | "duration" | "funding" | "id" | "name" | "summary" | "topic"
	> & {
		descriptionContentBlocks?: Array<ContentBlock>;
		entityVersion: {
			entity: Pick<schema.Entity, "id">;
			slug: Pick<schema.Slug, "value">;
			status: Pick<schema.EntityStatus, "id" | "type">;
		};
		scope: Pick<schema.ProjectScope, "id" | "scope">;
		call: Pick<schema.ProjectCall, "id" | "call"> | null;
	} & { image: SelectedImage | null };
	scopes: Array<Pick<schema.ProjectScope, "id" | "scope">>;
	calls: Array<Pick<schema.ProjectCall, "id" | "call">>;
	roles: Array<Pick<schema.ProjectRole, "id" | "role">>;
	initialSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal: number;
	selectedSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityIds: Array<string>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceIds: Array<string>;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
	selectedRelatedEntities: Array<{ id: string; name: string; description?: string }>;
	selectedRelatedResources: Array<{ id: string; name: string; description?: string }>;
	initialPartners: Array<{
		id: string;
		unitDocumentId: string;
		unitName: string;
		roleId: string;
		roleName: string;
		durationStart: Date | null;
		durationEnd: Date | null;
	}>;
	initialAffiliations: Array<{
		id: string;
		personDocumentId: string;
		personName: string;
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
		calls,
		initialSocialMediaIds,
		initialSocialMediaItems,
		initialSocialMediaTotal,
		selectedSocialMediaItems,
		initialRelatedEntityIds,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceIds,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		selectedRelatedEntities,
		selectedRelatedResources,
		roles,
		initialPartners,
		initialAffiliations,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("Edit project")} />

			<EntityEditTabs defaultTab="details">
				<TabList aria-label={t("Edit project")}>
					<EntityEditTab id="details">{t("Details")}</EntityEditTab>
					<EntityEditTab id="project-partners">{t("Project partners")}</EntityEditTab>
					<EntityEditTab id="affiliated-people">{t("Affiliated people")}</EntityEditTab>
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
						isDefaultLocale={isDefaultLocale}
						selectedLocaleCode={selectedLocaleCode}
						isPublished={isPublished}
						formAction={updateProjectAction}
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
						project={project}
						scopes={scopes}
						calls={calls}
						selectedRelatedEntities={selectedRelatedEntities}
						selectedRelatedResources={selectedRelatedResources}
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
				<TabPanel id="affiliated-people" shouldPreserveState={true}>
					<ProjectAffiliationsSection
						affiliations={initialAffiliations}
						projectDocumentId={documentId}
					/>
				</TabPanel>
			</EntityEditTabs>
		</Fragment>
	);
}
