"use client";

import type * as schema from "@dariah-eric/database/schema";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { DocumentOrPolicyForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_components/document-or-policy-form";
import { createDocumentOrPolicyAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/create-document-or-policy.action";

interface DocumentOrPolicyCreateFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	groups: Array<Pick<schema.DocumentPolicyGroup, "id" | "label">>;
}

export function DocumentOrPolicyCreateForm(
	props: Readonly<DocumentOrPolicyCreateFormProps>,
): ReactNode {
	const { initialAssets, groups } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New document or policy")} />

			<DocumentOrPolicyForm
				formAction={createDocumentOrPolicyAction}
				groups={groups}
				initialAssets={initialAssets}
			/>
		</Fragment>
	);
}
