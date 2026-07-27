"use client";

import { Note } from "@acdh-knowledge-base/ui/note";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { CountryForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/countries/_components/country-form";
import { createCountryAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/countries/_lib/create-country.action";

interface CountryCreateFormProps {
	defaultLocaleName: string;
	initialAssets: Array<{ key: string; label: string; url: string }>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
}

export function CountryCreateForm(props: Readonly<CountryCreateFormProps>): ReactNode {
	const {
		defaultLocaleName,
		initialAssets,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New country")} />

			<Note intent="info">
				{t(
					"This country will be created in the default locale ({locale}). You can add translations after saving.",
					{ locale: defaultLocaleName },
				)}
			</Note>

			<CountryForm
				formAction={createCountryAction}
				initialAssets={initialAssets}
				initialRelatedEntityItems={initialRelatedEntityItems}
				initialRelatedEntityTotal={initialRelatedEntityTotal}
				initialRelatedResourceItems={initialRelatedResourceItems}
				initialRelatedResourceTotal={initialRelatedResourceTotal}
				showSaveAndPublish={true}
			/>
		</Fragment>
	);
}
