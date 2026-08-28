"use client";

import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Description, FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { Input } from "@dariah-eric/ui/input";
import { Separator } from "@dariah-eric/ui/separator";
import { TextField } from "@dariah-eric/ui/text-field";
import { TextArea } from "@dariah-eric/ui/textarea";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import { EntityRelationsFields } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-relations-fields";
import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import {
	ImageSelectField,
	type SelectedImage,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { RichTextContentBlocksField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/rich-text-content-blocks-field";
import { SocialMediaRelationsFields } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/social-media-relations-fields";
import type { ServerAction } from "@/lib/server/create-server-action";

interface EricFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	/**
	 * Acronym/ROR/SSHOC actor ID aren't translatable — the DB keeps them synced from the default
	 * locale's version regardless, so this locks their inputs when editing another locale. Defaults
	 * to `true` (the create form has no locale concept, and always starts in the default locale).
	 */
	isDefaultLocale?: boolean;
	eric: Pick<
		schema.OrganisationalUnit,
		"acronym" | "id" | "name" | "ror" | "sshocMarketplaceActorId" | "summary"
	> & {
		descriptionContentBlocks?: Array<ContentBlock>;
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & { image: SelectedImage | null };
	formId?: string;
	formAction: ServerAction;
	initialRelatedEntityIds?: Array<string>;
	initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceIds?: Array<string>;
	initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
	initialRelatedResourceTotal: number;
	initialSocialMediaIds?: Array<string>;
	initialSocialMediaItems?: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal?: number;
	selectedRelatedEntities?: Array<{ id: string; name: string; description?: string }>;
	selectedRelatedResources?: Array<{ id: string; name: string; description?: string }>;
	selectedSocialMediaItems?: Array<{ id: string; name: string; description?: string }>;
	showSaveAndPublish?: boolean;
}

export function EricForm(props: Readonly<EricFormProps>): ReactNode {
	const {
		initialAssets,
		formAction,
		formId,
		isDefaultLocale = true,
		eric,
		initialRelatedEntityIds,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceIds,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		initialSocialMediaIds,
		initialSocialMediaItems,
		initialSocialMediaTotal,
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedSocialMediaItems,
		showSaveAndPublish,
	} = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(eric.image ?? null);

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" id={formId} state={state}>
				<FormSection description={t("Enter the DARIAH ERIC details.")} title={t("Details")}>
					<TextField defaultValue={eric.name} isRequired={true} name="name">
						<Label>{t("Name")}</Label>
						<Input />
						<FieldError />
					</TextField>

					{isDefaultLocale ? (
						<TextField defaultValue={eric.acronym ?? undefined} name="acronym">
							<Label>{t("Acronym")}</Label>
							<Input />
							<FieldError />
						</TextField>
					) : (
						<div className="flex flex-col gap-y-1">
							<Label>{t("Acronym")}</Label>
							<p className="text-sm">{eric.acronym ?? t("Not set")}</p>
							<Description>{t("Editable only in the default locale.")}</Description>
							{eric.acronym != null ? (
								<input name="acronym" type="hidden" value={eric.acronym} />
							) : null}
						</div>
					)}

					{isDefaultLocale ? (
						<TextField defaultValue={eric.ror ?? undefined} name="ror">
							<Label>{t("ROR")}</Label>
							<Input />
							<FieldError />
						</TextField>
					) : (
						<div className="flex flex-col gap-y-1">
							<Label>{t("ROR")}</Label>
							<p className="text-sm">{eric.ror ?? t("Not set")}</p>
							<Description>{t("Editable only in the default locale.")}</Description>
							{eric.ror != null ? <input name="ror" type="hidden" value={eric.ror} /> : null}
						</div>
					)}

					{isDefaultLocale ? (
						<TextField
							defaultValue={
								eric.sshocMarketplaceActorId != null
									? String(eric.sshocMarketplaceActorId)
									: undefined
							}
							name="sshocMarketplaceActorId"
							type="number"
						>
							<Label>{t("SSHOC actor ID")}</Label>
							<Input />
							<FieldError />
						</TextField>
					) : (
						<div className="flex flex-col gap-y-1">
							<Label>{t("SSHOC actor ID")}</Label>
							<p className="text-sm">
								{eric.sshocMarketplaceActorId != null
									? String(eric.sshocMarketplaceActorId)
									: t("Not set")}
							</p>
							<Description>{t("Editable only in the default locale.")}</Description>
							{eric.sshocMarketplaceActorId != null ? (
								<input
									name="sshocMarketplaceActorId"
									type="hidden"
									value={eric.sshocMarketplaceActorId}
								/>
							) : null}
						</div>
					)}

					<TextField defaultValue={eric.summary ?? undefined} name="summary">
						<Label>{t("Summary")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				<FormSection description={t("Select or upload an image.")} title={t("Image")}>
					<ImageSelectField
						allowRemove={true}
						defaultPrefix="logos"
						initialAssets={initialAssets}
						onChange={setSelectedImage}
						prefixes={["avatars", "images", "logos"]}
						selectedImage={selectedImage}
					/>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Add a description.")}
					title={t("Description")}
					variant="stacked"
				>
					<RichTextContentBlocksField
						aria-label={t("Description")}
						initialBlocks={eric.descriptionContentBlocks}
						initialAssets={initialAssets}
						name="description"
					/>
				</FormSection>

				<Separator className="my-6" />

				{initialSocialMediaItems != null && initialSocialMediaTotal != null ? (
					<Fragment>
						<SocialMediaRelationsFields
							description={t("Link social media accounts to DARIAH ERIC.")}
							initialSocialMediaIds={initialSocialMediaIds}
							initialSocialMediaItems={initialSocialMediaItems}
							initialSocialMediaTotal={initialSocialMediaTotal}
							selectedSocialMediaItems={selectedSocialMediaItems}
						/>

						<Separator className="my-6" />
					</Fragment>
				) : null}

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

				<input name="id" type="hidden" value={eric.id} />
				<input name="documentId" type="hidden" value={eric.entityVersion.entity.id} />

				<EntityFormActions
					entityName={t("DARIAH ERIC")}
					isPending={isPending}
					showSaveAndPublish={showSaveAndPublish}
					state={state}
				/>
			</Form>
		</FormLayout>
	);
}
