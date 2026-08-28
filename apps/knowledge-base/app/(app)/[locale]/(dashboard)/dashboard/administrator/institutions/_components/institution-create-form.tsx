"use client";

import { Note } from "@dariah-eric/ui/note";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { InstitutionForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/institutions/_components/institution-form";
import { createInstitutionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/institutions/_lib/create-institution.action";

interface InstitutionCreateFormProps {
	defaultLocaleName: string;
	initialAssets: Array<{ key: string; label: string; url: string }>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
	initialSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal: number;
}

export function InstitutionCreateForm(props: Readonly<InstitutionCreateFormProps>): ReactNode {
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
			<EntityFormHeader title={t("New institution")} />

			<Note intent="info">
				{t(
					"This institution will be created in the default locale ({locale}). You can add translations after saving.",
					{ locale: defaultLocaleName },
				)}
			</Note>

			<InstitutionForm
				formAction={createInstitutionAction}
				initialAssets={initialAssets}
				initialRelatedEntityItems={initialRelatedEntityItems}
				initialRelatedEntityTotal={initialRelatedEntityTotal}
				initialRelatedResourceItems={initialRelatedResourceItems}
				initialRelatedResourceTotal={initialRelatedResourceTotal}
				initialSocialMediaItems={initialSocialMediaItems}
				initialSocialMediaTotal={initialSocialMediaTotal}
			/>
		</Fragment>
	);
}
