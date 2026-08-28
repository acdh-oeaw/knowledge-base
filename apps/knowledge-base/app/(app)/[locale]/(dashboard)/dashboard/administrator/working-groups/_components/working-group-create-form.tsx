"use client";

import { Note } from "@dariah-eric/ui/note";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { EntityRelationsFields } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-relations-fields";
import { WorkingGroupForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_components/working-group-form";
import { createWorkingGroupAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_lib/create-working-group.action";

interface WorkingGroupCreateFormProps {
	defaultLocaleName: string;
	initialAssets: Array<{ key: string; label: string; url: string }>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
	initialSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal: number;
}

export function WorkingGroupCreateForm(props: Readonly<WorkingGroupCreateFormProps>): ReactNode {
	const {
		defaultLocaleName,
		initialAssets,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		initialSocialMediaItems,
		initialSocialMediaTotal,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New working group")} />

			<Note intent="info">
				{t(
					"This working group will be created in the default locale ({locale}). You can add translations after saving.",
					{ locale: defaultLocaleName },
				)}
			</Note>
			<WorkingGroupForm
				formAction={createWorkingGroupAction}
				initialAssets={initialAssets}
				initialSocialMediaItems={initialSocialMediaItems}
				initialSocialMediaTotal={initialSocialMediaTotal}
			>
				<EntityRelationsFields
					initialRelatedEntityItems={initialRelatedEntityItems}
					initialRelatedEntityTotal={initialRelatedEntityTotal}
					initialRelatedResourceItems={initialRelatedResourceItems}
					initialRelatedResourceTotal={initialRelatedResourceTotal}
				/>
			</WorkingGroupForm>
		</Fragment>
	);
}
