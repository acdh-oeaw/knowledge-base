"use client";

import type * as schema from "@dariah-eric/database/schema";
import { Note } from "@dariah-eric/ui/note";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { ProjectForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-form";
import { createProjectAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/create-project.action";

interface ProjectCreateFormProps {
	defaultLocaleName: string;
	initialAssets: Array<{ key: string; label: string; url: string }>;
	scopes: Array<Pick<schema.ProjectScope, "id" | "scope">>;
	calls: Array<Pick<schema.ProjectCall, "id" | "call">>;
	initialSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal: number;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
}

export function ProjectCreateForm(props: Readonly<ProjectCreateFormProps>): ReactNode {
	const {
		defaultLocaleName,
		initialAssets,
		scopes,
		calls,
		initialSocialMediaItems,
		initialSocialMediaTotal,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New project")} />
			<Note intent="info">
				{t(
					"This project will be created in the default locale ({locale}). You can add translations after saving.",
					{ locale: defaultLocaleName },
				)}
			</Note>

			<ProjectForm
				formAction={createProjectAction}
				initialAssets={initialAssets}
				initialRelatedEntityItems={initialRelatedEntityItems}
				initialRelatedEntityTotal={initialRelatedEntityTotal}
				initialRelatedResourceItems={initialRelatedResourceItems}
				initialRelatedResourceTotal={initialRelatedResourceTotal}
				initialSocialMediaItems={initialSocialMediaItems}
				initialSocialMediaTotal={initialSocialMediaTotal}
				scopes={scopes}
				calls={calls}
			/>
		</Fragment>
	);
}
