"use client";

import type * as schema from "@dariah-eric/database/schema";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { DocumentOrPolicyForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_components/document-or-policy-form";
import { discardDocumentOrPolicyDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/discard-document-or-policy-draft.action";
import { publishDocumentOrPolicyAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/publish-document-or-policy.action";
import { updateDocumentOrPolicyAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/update-document-or-policy.action";

interface DocumentOrPolicyEditFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraftChanges: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	documentOrPolicy: Pick<
		schema.DocumentOrPolicy,
		"id" | "title" | "summary" | "url" | "groupId"
	> & {
		entityVersion: {
			entity: { id: string };
			slug: { value: string };
		};
	} & { document: { key: string; label: string; url: string } };
	groups: Array<Pick<schema.DocumentPolicyGroup, "id" | "label">>;
}

export function DocumentOrPolicyEditForm(
	props: Readonly<DocumentOrPolicyEditFormProps>,
): ReactNode {
	const {
		initialAssets,
		contentBlocks,
		documentId,
		hasDraftChanges,
		isPublished,
		locales,
		selectedLocaleCode,
		documentOrPolicy,
		groups,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader
				title={t("Edit document or policy")}
				lifecycle={{
					documentId,
					hasDraft: hasDraftChanges,
					isPublished,
					publishAction: publishDocumentOrPolicyAction,
					discardDraftAction: discardDocumentOrPolicyDraftAction,
				}}
				localeSelector={
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				}
			/>

			<DocumentOrPolicyForm
				contentBlocks={contentBlocks}
				documentOrPolicy={documentOrPolicy}
				isPublished={isPublished}
				formAction={updateDocumentOrPolicyAction}
				groups={groups}
				initialAssets={initialAssets}
			/>
		</Fragment>
	);
}
