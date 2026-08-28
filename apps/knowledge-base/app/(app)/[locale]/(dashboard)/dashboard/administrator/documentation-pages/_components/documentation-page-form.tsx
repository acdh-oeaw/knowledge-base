"use client";

import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { Input } from "@dariah-eric/ui/input";
import { Separator } from "@dariah-eric/ui/separator";
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import {
	type ContentBlock,
	ContentBlocks,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import { EntitySlugField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-slug-field";
import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type { ServerAction } from "@/lib/server/create-server-action";

interface DocumentationPageFormProps {
	contentBlocks?: Array<ContentBlock>;
	documentationPage?: Pick<schema.DocumentationPage, "id" | "title"> & {
		entityVersion: { slug: Pick<schema.Slug, "value"> };
	};
	/**
	 * Whether the edited documentation page is published, which freezes its slug. Unused when
	 * creating.
	 */
	isPublished?: boolean;
	formAction: ServerAction;
}

export function DocumentationPageForm(props: Readonly<DocumentationPageFormProps>): ReactNode {
	const { contentBlocks, documentationPage, formAction, isPublished } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Enter the documentation page details.")} title={t("Details")}>
					<TextField defaultValue={documentationPage?.title} isRequired={true} name="title">
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<EntitySlugField
						isPublished={isPublished}
						slug={documentationPage?.entityVersion.slug.value}
					/>
				</FormSection>

				<Separator className="my-6" />

				<FormSection description={t("Add the content.")} title={t("Content")} variant="stacked">
					<ContentBlocks items={contentBlocks ?? []} />
				</FormSection>

				{documentationPage != null ? (
					<Fragment>
						<input name="id" type="hidden" value={documentationPage.id} />
						<input
							name="documentId"
							type="hidden"
							value={documentationPage.entityVersion.slug.value}
						/>
					</Fragment>
				) : null}

				<EntityFormActions
					entityName={t("Documentation page")}
					isPending={isPending}
					state={state}
				/>
			</Form>
		</FormLayout>
	);
}
