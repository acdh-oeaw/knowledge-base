"use client";

import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { PersonForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_components/person-form";
import { createPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/create-person.action";

interface PersonCreateFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	initialSocialMediaItems: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal: number;
}

export function PersonCreateForm(props: Readonly<PersonCreateFormProps>): ReactNode {
	const { initialAssets, initialSocialMediaItems, initialSocialMediaTotal } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New person")} />

			<PersonForm
				formAction={createPersonAction}
				initialAssets={initialAssets}
				initialSocialMediaItems={initialSocialMediaItems}
				initialSocialMediaTotal={initialSocialMediaTotal}
			/>
		</Fragment>
	);
}
