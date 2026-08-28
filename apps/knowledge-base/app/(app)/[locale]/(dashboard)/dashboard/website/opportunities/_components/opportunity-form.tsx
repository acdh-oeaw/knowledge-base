"use client";

import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { DatePicker, DatePickerTrigger } from "@dariah-eric/ui/date-picker";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { Input } from "@dariah-eric/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
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

interface OpportunityFormProps {
	contentBlocks?: Array<ContentBlock>;
	initialAssets: Array<{ key: string; label: string; url: string }>;
	initialRelatedEntityIds?: Array<string>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceIds?: Array<string>;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
	opportunity?: Pick<schema.Opportunity, "id" | "duration" | "title" | "summary" | "website"> & {
		entityVersion: {
			entity: Pick<schema.Entity, "id">;
			slug: Pick<schema.Slug, "value">;
			status: Pick<schema.EntityStatus, "id" | "type">;
		};
		source: Pick<schema.OpportunitySource, "id" | "source">;
	} & {
		image: SelectedImage;
		imageCaption?: JSONContent | null;
		imageCaptionMode?: ImageCaptionMode;
	};
	/** Whether the edited entity is published, which freezes its slug. Unused when creating. */
	isPublished?: boolean;
	formAction: ServerAction;
	selectedRelatedEntities?: Array<{ id: string; name: string; description?: string }>;
	selectedRelatedResources?: Array<{ id: string; name: string; description?: string }>;
	sources: Array<Pick<schema.OpportunitySource, "id" | "source">>;
}

export function OpportunityForm(props: Readonly<OpportunityFormProps>): ReactNode {
	const {
		initialAssets,
		contentBlocks,
		formAction,
		initialRelatedEntityIds,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceIds,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		opportunity,
		selectedRelatedEntities,
		selectedRelatedResources,
		sources,
		isPublished,
	} = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
		opportunity?.image ?? null,
	);

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Enter the opportunity details.")} title={t("Details")}>
					<TextField defaultValue={opportunity?.title} isRequired={true} name="title">
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<Select
						defaultValue={opportunity?.source.id ?? undefined}
						isRequired={true}
						name="sourceId"
					>
						<Label>{t("Source")}</Label>
						<SelectTrigger />
						<FieldError />
						<SelectContent>
							{sources.map((item) => (
								<SelectItem key={item.id} id={item.id}>
									{item.source}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<TextField
						defaultValue={opportunity?.summary ?? undefined}
						isRequired={true}
						name="summary"
					>
						<Label>{t("Summary")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>
					<DatePicker
						defaultValue={
							opportunity != null
								? new CalendarDate(
										opportunity.duration.start.getUTCFullYear(),
										opportunity.duration.start.getUTCMonth() + 1,
										opportunity.duration.start.getUTCDate(),
									)
								: undefined
						}
						granularity="day"
						isRequired={true}
						name="duration.start"
					>
						<Label>{t("Start date")}</Label>
						<DatePickerTrigger />
					</DatePicker>

					<DatePicker
						defaultValue={
							opportunity?.duration.end != null
								? new CalendarDate(
										opportunity.duration.end.getUTCFullYear(),
										opportunity.duration.end.getUTCMonth() + 1,
										opportunity.duration.end.getUTCDate(),
									)
								: undefined
						}
						granularity="day"
						name="duration.end"
					>
						<Label>{t("End date")}</Label>
						<DatePickerTrigger />
					</DatePicker>
					<TextField defaultValue={opportunity?.website ?? undefined} name="website" type="url">
						<Label>{t("Website")}</Label>
						<Input placeholder="https://" />
						<FieldError />
					</TextField>

					<EntitySlugField isPublished={isPublished} slug={opportunity?.entityVersion.slug.value} />
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Select or upload an image.")}
					isRequired={true}
					title={t("Image")}
				>
					<ImageSelectField
						captionName="imageCaption"
						defaultCaption={opportunity?.imageCaption}
						defaultCaptionMode={opportunity?.imageCaptionMode}
						defaultPrefix="images"
						initialAssets={initialAssets}
						isRequired={true}
						onChange={setSelectedImage}
						prefixes={["avatars", "images", "logos"]}
						selectedImage={selectedImage}
					/>
				</FormSection>

				<Separator className="my-6" />

				<FormSection description={t("Add the content.")} title={t("Content")} variant="stacked">
					<ContentBlocks items={contentBlocks ?? []} />
				</FormSection>

				<Separator className="my-6" />

				<EntityRelationsFields
					initialRelatedEntityIds={initialRelatedEntityIds}
					initialRelatedEntityItems={initialRelatedEntityItems}
					initialRelatedEntityTotal={initialRelatedEntityTotal}
					initialRelatedResourceIds={initialRelatedResourceIds}
					initialRelatedResourceItems={initialRelatedResourceItems}
					initialRelatedResourceTotal={initialRelatedResourceTotal}
					selectedRelatedEntities={selectedRelatedEntities}
					selectedRelatedResources={selectedRelatedResources}
				/>

				{opportunity != null ? (
					<Fragment>
						<input name="id" type="hidden" value={opportunity.id} />
						<input name="documentId" type="hidden" value={opportunity.entityVersion.entity.id} />
					</Fragment>
				) : null}

				<EntityFormActions entityName={t("Opportunity")} isPending={isPending} state={state} />
			</Form>
		</FormLayout>
	);
}
