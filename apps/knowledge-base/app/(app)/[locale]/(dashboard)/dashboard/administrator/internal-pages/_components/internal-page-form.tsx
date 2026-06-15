"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { Input } from "@acdh-knowledge-base/ui/input";
import { Separator } from "@acdh-knowledge-base/ui/separator";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState } from "react";

import {
	type ContentBlock,
	ContentBlocks,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type { ServerAction } from "@/lib/server/create-server-action";

interface InternalPageFormProps {
	contentBlocks?: Array<ContentBlock>;
	formAction: ServerAction;
	internalPage: Pick<schema.InternalPage, "id" | "title"> & {
		entityVersion: { entity: Pick<schema.Entity, "id"> };
	};
}

export function InternalPageForm(props: Readonly<InternalPageFormProps>): ReactNode {
	const { contentBlocks, formAction, internalPage } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Enter the internal page details.")} title={t("Details")}>
					<TextField defaultValue={internalPage.title} isRequired={true} name="title">
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				<FormSection description={t("Add the content.")} title={t("Content")} variant="stacked">
					<ContentBlocks items={contentBlocks ?? []} />
				</FormSection>

				<input name="id" type="hidden" value={internalPage.id} />
				<input name="documentId" type="hidden" value={internalPage.entityVersion.entity.id} />

				<EntityFormActions entityName={t("Internal page")} isPending={isPending} state={state} />
			</Form>
		</FormLayout>
	);
}
