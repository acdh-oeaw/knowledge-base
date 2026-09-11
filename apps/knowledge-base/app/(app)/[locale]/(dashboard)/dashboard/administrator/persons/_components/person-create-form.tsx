"use client";

import { Note } from "@dariah-eric/ui/note";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { PersonForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_components/person-form";
import { createPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/create-person.action";

interface PersonCreateFormProps {
	defaultLocaleName: string;
	initialAssets: Array<{ key: string; label: string; url: string }>;
}

export function PersonCreateForm(props: Readonly<PersonCreateFormProps>): ReactNode {
	const { defaultLocaleName, initialAssets } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New person")} />

			<Note intent="info">
				{t(
					"This person will be created in the default locale ({locale}). You can add translations after saving.",
					{ locale: defaultLocaleName },
				)}
			</Note>

			<PersonForm
				formAction={createPersonAction}
				initialAssets={initialAssets}
				isDefaultLocale={true}
			/>
		</Fragment>
	);
}
