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
import { SocialMediaRelationsFields } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/social-media-relations-fields";
import type { ServerAction } from "@/lib/server/create-server-action";

interface WorkingGroupFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	/**
	 * Acronym/SSHOC actor ID aren't translatable — the DB keeps them synced from the default locale's
	 * version regardless, so this locks their inputs when editing another locale. Defaults to `true`
	 * (the create form has no locale concept, and always starts in the default locale).
	 */
	isDefaultLocale?: boolean;
	workingGroup?: Pick<
		schema.OrganisationalUnit,
		"acronym" | "email" | "id" | "mailingList" | "name" | "sshocMarketplaceActorId" | "summary"
	> & {
		descriptionContentBlocks?: Array<ContentBlock>;
		entityVersion: { entity: { id: string }; slug: { value: string } };
	} & { image: SelectedImage | null };
	formId?: string;
	/** Whether the edited entity is published, which freezes its slug. Unused when creating. */
	isPublished?: boolean;
	formAction: ServerAction;
	initialSocialMediaIds?: Array<string>;
	initialSocialMediaItems?: Array<{ id: string; name: string; description?: string }>;
	initialSocialMediaTotal?: number;
	selectedSocialMediaItems?: Array<{ id: string; name: string; description?: string }>;
	showSaveAndPublish?: boolean;
	/** Optional composed sections (e.g. related entities/resources) rendered before the form actions. */
	children?: ReactNode;
}

export function WorkingGroupForm(props: Readonly<WorkingGroupFormProps>): ReactNode {
	const {
		initialAssets,
		formAction,
		formId,
		isDefaultLocale = true,
		workingGroup,
		initialSocialMediaIds,
		initialSocialMediaItems,
		initialSocialMediaTotal,
		selectedSocialMediaItems,
		showSaveAndPublish,
		children,
		isPublished,
	} = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
		workingGroup?.image ?? null,
	);

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" id={formId} state={state}>
				<FormSection description={t("Enter the working group details.")} title={t("Details")}>
					<TextField defaultValue={workingGroup?.name} isRequired={true} name="name">
						<Label>{t("Name")}</Label>
						<Input />
						<FieldError />
					</TextField>

					{isDefaultLocale ? (
						<TextField defaultValue={workingGroup?.acronym ?? undefined} name="acronym">
							<Label>{t("Acronym")}</Label>
							<Input />
							<FieldError />
						</TextField>
					) : (
						<div className="flex flex-col gap-y-1">
							<Label>{t("Acronym")}</Label>
							<p className="text-sm">{workingGroup?.acronym ?? t("Not set")}</p>
							<Description>{t("Editable only in the default locale.")}</Description>
							{workingGroup?.acronym != null ? (
								<input name="acronym" type="hidden" value={workingGroup.acronym} />
							) : null}
						</div>
					)}

					{isDefaultLocale ? (
						<TextField
							defaultValue={
								workingGroup?.sshocMarketplaceActorId != null
									? String(workingGroup.sshocMarketplaceActorId)
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
								{workingGroup?.sshocMarketplaceActorId != null
									? String(workingGroup.sshocMarketplaceActorId)
									: t("Not set")}
							</p>
							<Description>{t("Editable only in the default locale.")}</Description>
							{workingGroup?.sshocMarketplaceActorId != null ? (
								<input
									name="sshocMarketplaceActorId"
									type="hidden"
									value={workingGroup.sshocMarketplaceActorId}
								/>
							) : null}
						</div>
					)}

					<TextField defaultValue={workingGroup?.summary ?? undefined} name="summary">
						<Label>{t("Summary")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>

					<EntitySlugField
						isPublished={isPublished}
						slug={workingGroup?.entityVersion.slug.value}
					/>
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
						initialBlocks={workingGroup?.descriptionContentBlocks}
						initialAssets={initialAssets}
						name="description"
					/>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Enter the working group contact details.")}
					title={t("Contact")}
				>
					<TextField defaultValue={workingGroup?.email ?? undefined} name="email" type="email">
						<Label>{t("Email")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<TextField defaultValue={workingGroup?.mailingList ?? undefined} name="mailingList">
						<Label>{t("Mailing list")}</Label>
						<Input />
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				{initialSocialMediaItems != null && initialSocialMediaTotal != null ? (
					<Fragment>
						<SocialMediaRelationsFields
							description={t("Link social media accounts to this working group.")}
							initialSocialMediaIds={initialSocialMediaIds}
							initialSocialMediaItems={initialSocialMediaItems}
							initialSocialMediaTotal={initialSocialMediaTotal}
							selectedSocialMediaItems={selectedSocialMediaItems}
						/>

						<Separator className="my-6" />
					</Fragment>
				) : null}

				{children}

				{workingGroup != null ? (
					<Fragment>
						<input name="id" type="hidden" value={workingGroup.id} />
						<input name="documentId" type="hidden" value={workingGroup.entityVersion.entity.id} />
					</Fragment>
				) : null}

				<EntityFormActions
					entityName={t("Working group")}
					isPending={isPending}
					showSaveAndPublish={showSaveAndPublish}
					state={state}
				/>
			</Form>
		</FormLayout>
	);
}
