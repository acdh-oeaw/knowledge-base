"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { ProjectForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-form";
import { createProjectAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/create-project.action";

interface ProjectCreateFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	scopes: Array<Pick<schema.ProjectScope, "id" | "scope">>;
	initialSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal: number;
}

export function ProjectCreateForm(props: Readonly<ProjectCreateFormProps>): ReactNode {
	const { initialAssets, scopes, initialSocialMediaItems, initialSocialMediaTotal } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New project")} />

			<ProjectForm
				formAction={createProjectAction}
				initialAssets={initialAssets}
				initialSocialMediaItems={initialSocialMediaItems}
				initialSocialMediaTotal={initialSocialMediaTotal}
				scopes={scopes}
			/>
		</Fragment>
	);
}
