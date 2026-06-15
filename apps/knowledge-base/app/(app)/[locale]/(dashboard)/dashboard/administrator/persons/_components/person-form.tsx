"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { Input } from "@acdh-knowledge-base/ui/input";
import { Separator } from "@acdh-knowledge-base/ui/separator";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { ImageSelectField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { RichTextContentBlocksField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/rich-text-content-blocks-field";
import type { ServerAction } from "@/lib/server/create-server-action";

interface PersonFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	person?: Pick<schema.Person, "email" | "id" | "name" | "orcid" | "sortName"> & {
		biographyContentBlocks?: Array<ContentBlock>;
		entityVersion: { entity: { id: string; slug: string } };
	} & { image: { key: string; label: string; url: string } | null };
	formAction: ServerAction;
}

export function PersonForm(props: Readonly<PersonFormProps>): ReactNode {
	const { initialAssets, formAction, person } = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedImage, setSelectedImage] = useState<{ key: string; url: string } | null>(
		person?.image ?? null,
	);

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection
					description={t("Enter the personal and contact details related to the person.")}
					title={t("Details")}
				>
					<TextField defaultValue={person?.name} isRequired={true} name="name">
						<Label>{t("Name")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<TextField defaultValue={person?.sortName} isRequired={true} name="sortName">
						<Label>{t("Sort name")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<TextField defaultValue={person?.email ?? undefined} name="email" type="email">
						<Label>{t("Email")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<TextField defaultValue={person?.orcid ?? undefined} name="orcid">
						<Label>{t("ORCID")}</Label>
						<Input />
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				<FormSection description={t("Select or upload an image.")} title={t("Image")}>
					<ImageSelectField
						allowRemove={true}
						defaultPrefix="avatars"
						initialAssets={initialAssets}
						onChange={setSelectedImage}
						prefixes={["avatars"]}
						selectedImage={selectedImage}
					/>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Add a short biography.")}
					title={t("Biography")}
					variant="stacked"
				>
					<RichTextContentBlocksField
						aria-label={t("Biography")}
						initialBlocks={person?.biographyContentBlocks}
						initialAssets={initialAssets}
						name="biography"
					/>
				</FormSection>

				{person != null ? (
					<Fragment>
						<input name="id" type="hidden" value={person.id} />
						<input name="documentId" type="hidden" value={person.entityVersion.entity.id} />
					</Fragment>
				) : null}

				<EntityFormActions entityName={t("Person")} isPending={isPending} state={state} />
			</Form>
		</FormLayout>
	);
}
