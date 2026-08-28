"use client";

import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { DatePicker, DatePickerTrigger } from "@dariah-eric/ui/date-picker";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { Input } from "@dariah-eric/ui/input";
import { Separator } from "@dariah-eric/ui/separator";
import { TextField } from "@dariah-eric/ui/text-field";
import { TextArea } from "@dariah-eric/ui/textarea";
import { CalendarDate } from "@internationalized/date";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import {
	type ContentBlock,
	ContentBlocks,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import { EntityRelationsFields } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-relations-fields";
import { EntitySlugField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-slug-field";
import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import {
	ImageSelectField,
	type SelectedImage,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import type { ServerAction } from "@/lib/server/create-server-action";

interface SpotlightArticleFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	contentBlocks?: Array<ContentBlock>;
	spotlightArticle?: Pick<
		schema.SpotlightArticle,
		"id" | "publicationDate" | "title" | "summary"
	> & {
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & {
		image: SelectedImage;
		imageCaption?: JSONContent | null;
		imageCaptionMode?: ImageCaptionMode;
	};
	formId?: string;
	/** Whether the edited entity is published, which freezes its slug. Unused when creating. */
	isPublished?: boolean;
	formAction: ServerAction;
	initialRelatedEntityIds?: Array<string>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceIds?: Array<string>;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
	selectedRelatedEntities?: Array<{ id: string; name: string; description?: string }>;
	selectedRelatedResources?: Array<{ id: string; name: string; description?: string }>;
	showRelationFields?: boolean;
}

export function SpotlightArticleForm(props: Readonly<SpotlightArticleFormProps>): ReactNode {
	const {
		initialAssets,
		contentBlocks,
		formAction,
		formId,
		spotlightArticle,
		initialRelatedEntityIds,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceIds,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		selectedRelatedEntities,
		selectedRelatedResources,
		showRelationFields = true,
		isPublished,
	} = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
		spotlightArticle?.image ?? null,
	);
	const now = new Date();
	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" id={formId} state={state}>
				<FormSection description={t("Enter the spotlight article details.")} title={t("Details")}>
					<TextField defaultValue={spotlightArticle?.title} isRequired={true} name="title">
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={spotlightArticle?.summary ?? undefined}
						isRequired={true}
						name="summary"
					>
						<Label>{t("Summary")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>

					<DatePicker
						defaultValue={
							spotlightArticle != null
								? new CalendarDate(
										spotlightArticle.publicationDate.getUTCFullYear(),
										spotlightArticle.publicationDate.getUTCMonth() + 1,
										spotlightArticle.publicationDate.getUTCDate(),
									)
								: new CalendarDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
						}
						granularity="day"
						isRequired={true}
						name="publicationDate"
					>
						<Label>{t("Publication date")}</Label>
						<DatePickerTrigger />
					</DatePicker>

					<EntitySlugField
						isPublished={isPublished}
						slug={spotlightArticle?.entityVersion.slug.value}
					/>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Select or upload an image.")}
					isRequired={true}
					title={t("Image")}
				>
					<ImageSelectField
						captionName="imageCaption"
						defaultCaption={spotlightArticle?.imageCaption}
						defaultCaptionMode={spotlightArticle?.imageCaptionMode}
						defaultPrefix="images"
						initialAssets={initialAssets}
						isRequired={true}
						onChange={setSelectedImage}
						prefixes={["avatars", "images", "logos"]}
						selectedImage={selectedImage}
					/>
				</FormSection>

				<Separator className="my-6" />

				{showRelationFields ? (
					<Fragment>
						<EntityRelationsFields
							formId={formId}
							initialRelatedEntityIds={initialRelatedEntityIds}
							initialRelatedEntityItems={initialRelatedEntityItems}
							initialRelatedEntityTotal={initialRelatedEntityTotal}
							initialRelatedResourceIds={initialRelatedResourceIds}
							initialRelatedResourceItems={initialRelatedResourceItems}
							initialRelatedResourceTotal={initialRelatedResourceTotal}
							selectedRelatedEntities={selectedRelatedEntities}
							selectedRelatedResources={selectedRelatedResources}
						/>

						<Separator className="my-6" />
					</Fragment>
				) : null}

				<FormSection description={t("Add the content.")} title={t("Content")} variant="stacked">
					{/* Long-form editorial writing which sources what it reports, so it carries the same
					    citation apparatus as an impact case study. */}
					<ContentBlocks
						hasFootnotes={true}
						initialAssets={initialAssets}
						items={contentBlocks ?? []}
					/>
				</FormSection>

				{spotlightArticle != null ? (
					<Fragment>
						<input name="id" type="hidden" value={spotlightArticle.id} />
						<input
							name="documentId"
							type="hidden"
							value={spotlightArticle.entityVersion.entity.id}
						/>
					</Fragment>
				) : null}

				<EntityFormActions
					entityName={t("Spotlight article")}
					isPending={isPending}
					state={state}
				/>
			</Form>
		</FormLayout>
	);
}
