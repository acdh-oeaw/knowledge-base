"use client";

import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Description, FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { Input } from "@dariah-eric/ui/input";
import { Separator } from "@dariah-eric/ui/separator";
import { TextField } from "@dariah-eric/ui/text-field";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import { EntitySlugField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-slug-field";
import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import {
	ImageSelectField,
	type SelectedImage,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { RichTextContentBlocksField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/rich-text-content-blocks-field";
import { PersonSocialMediaFields } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_components/person-social-media-fields";
import type { PersonSocialMediaEntry } from "@/lib/data/person-social-media";
import type { ServerAction } from "@/lib/server/create-server-action";

interface PersonFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	isDefaultLocale?: boolean;
	person?: Pick<schema.Person, "email" | "id" | "name" | "orcid" | "sortName"> & {
		biographyContentBlocks?: Array<ContentBlock>;
		entityVersion: { entity: { id: string }; slug: { value: string } };
		socialMedia?: Array<PersonSocialMediaEntry>;
	} & {
		image: SelectedImage | null;
		imageCaption?: JSONContent | null;
		imageCaptionMode?: ImageCaptionMode;
	};
	/** Whether the edited person is published, which freezes its slug. Unused when creating. */
	isPublished?: boolean;
	formAction: ServerAction;
}

export function PersonForm(props: Readonly<PersonFormProps>): ReactNode {
	const { initialAssets, formAction, isDefaultLocale, isPublished, person } = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(person?.image ?? null);

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

					{isDefaultLocale ? (
						<TextField defaultValue={person?.email ?? undefined} name="email" type="email">
							<Label>{t("Email")}</Label>
							<Input />
							<FieldError />
						</TextField>
					) : (
						<div className="flex flex-col gap-y-1">
							<Label>{t("Email")}</Label>
							<p className="text-sm">{person?.email ?? t("Not set")}</p>
							<Description>{t("Editable only in the default locale.")}</Description>
							{person?.email != null ? (
								<input name="email" type="hidden" value={person.email} />
							) : null}
						</div>
					)}

					{isDefaultLocale ? (
						<TextField defaultValue={person?.orcid ?? undefined} name="orcid">
							<Label>{t("ORCID")}</Label>
							<Input />
							<FieldError />
						</TextField>
					) : (
						<div className="flex flex-col gap-y-1">
							<Label>{t("ORCID")}</Label>
							<p className="text-sm">{person?.orcid ?? t("Not set")}</p>
							<Description>{t("Editable only in the default locale.")}</Description>
							{person?.orcid != null ? (
								<input name="orcid" type="hidden" value={person.orcid} />
							) : null}
						</div>
					)}
					<EntitySlugField isPublished={isPublished} slug={person?.entityVersion.slug.value} />
				</FormSection>

				<Separator className="my-6" />

				<PersonSocialMediaFields initialSocialMedia={person?.socialMedia} />

				<Separator className="my-6" />

				<FormSection description={t("Select or upload an image.")} title={t("Image")}>
					<ImageSelectField
						allowRemove={true}
						captionName="imageCaption"
						defaultCaption={person?.imageCaption}
						defaultCaptionMode={person?.imageCaptionMode}
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
