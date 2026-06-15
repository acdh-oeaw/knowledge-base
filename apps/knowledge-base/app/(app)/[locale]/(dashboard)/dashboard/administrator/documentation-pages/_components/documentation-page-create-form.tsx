"use client";

import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { DocumentationPageForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_components/documentation-page-form";
import { createDocumentationPageAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_lib/create-documentation-page.action";

export function DocumentationPageCreateForm(): ReactNode {
	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New documentation page")} />
			<DocumentationPageForm formAction={createDocumentationPageAction} />
		</Fragment>
	);
}
