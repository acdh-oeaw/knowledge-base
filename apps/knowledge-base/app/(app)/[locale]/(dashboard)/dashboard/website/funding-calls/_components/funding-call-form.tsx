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

interface FundingCallFormProps {
	contentBlocks?: Array<ContentBlock>;
	initialAssets: Array<{ key: string; label: string; url: string }>;
	initialRelatedEntityIds?: Array<string>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceIds?: Array<string>;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
	fundingCall?: Pick<schema.FundingCall, "id" | "duration" | "title" | "summary"> & {
		entityVersion: {
			entity: Pick<schema.Entity, "id">;
			slug: Pick<schema.Slug, "value">;
			status: Pick<schema.EntityStatus, "id" | "type">;
		};
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
}

export function FundingCallForm(props: Readonly<FundingCallFormProps>): ReactNode {
	const {
		initialAssets,
		contentBlocks,
		formAction,
		fundingCall,
		initialRelatedEntityIds,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceIds,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		isPublished,
		selectedRelatedEntities,
		selectedRelatedResources,
	} = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
		fundingCall?.image ?? null,
	);

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Enter the funding call details.")} title={t("Details")}>
					<TextField defaultValue={fundingCall?.title} isRequired={true} name="title">
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>
					<TextField
						defaultValue={fundingCall?.summary ?? undefined}
						isRequired={true}
						name="summary"
					>
						<Label>{t("Summary")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>
					<DatePicker
						defaultValue={
							fundingCall != null
								? new CalendarDate(
										fundingCall.duration.start.getUTCFullYear(),
										fundingCall.duration.start.getUTCMonth() + 1,
										fundingCall.duration.start.getUTCDate(),
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
							fundingCall?.duration.end != null
								? new CalendarDate(
										fundingCall.duration.end.getUTCFullYear(),
										fundingCall.duration.end.getUTCMonth() + 1,
										fundingCall.duration.end.getUTCDate(),
									)
								: undefined
						}
						granularity="day"
						name="duration.end"
					>
						<Label>{t("End date")}</Label>
						<DatePickerTrigger />
					</DatePicker>

					<EntitySlugField isPublished={isPublished} slug={fundingCall?.entityVersion.slug.value} />
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Select or upload an image.")}
					isRequired={true}
					title={t("Image")}
				>
					<ImageSelectField
						captionName="imageCaption"
						defaultCaption={fundingCall?.imageCaption}
						defaultCaptionMode={fundingCall?.imageCaptionMode}
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

				{fundingCall != null ? (
					<Fragment>
						<input name="id" type="hidden" value={fundingCall.id} />
						<input name="documentId" type="hidden" value={fundingCall.entityVersion.entity.id} />
					</Fragment>
				) : null}

				<EntityFormActions entityName={t("Funding call")} isPending={isPending} state={state} />
			</Form>
		</FormLayout>
	);
}
