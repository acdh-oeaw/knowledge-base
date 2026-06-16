"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { socialMediaTypesEnum } from "@acdh-knowledge-base/database/schema";
import { type ActionState, createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { AsyncMultipleSelect } from "@acdh-knowledge-base/ui/async-multiple-select";
import { Button } from "@acdh-knowledge-base/ui/button";
import { DatePicker, DatePickerTrigger } from "@acdh-knowledge-base/ui/date-picker";
import { Description, FieldError, Label, fieldErrorStyles } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { FormStatus } from "@acdh-knowledge-base/ui/form-status";
import { Input } from "@acdh-knowledge-base/ui/input";
import {
	ModalBody,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@acdh-knowledge-base/ui/modal";
import { NumberField } from "@acdh-knowledge-base/ui/number-field";
import { ProgressCircle } from "@acdh-knowledge-base/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@acdh-knowledge-base/ui/select";
import { Separator } from "@acdh-knowledge-base/ui/separator";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { TextArea } from "@acdh-knowledge-base/ui/textarea";
import type {
	AsyncOption,
	AsyncOptionsFetchPageParams,
} from "@acdh-knowledge-base/ui/use-async-options";
import { PlusIcon } from "@heroicons/react/20/solid";
import { CalendarDate } from "@internationalized/date";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState, useTransition } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { MediaLibraryDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-dialog";
import { RichTextContentBlocksField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/rich-text-content-blocks-field";
import {
	type CreatedSocialMedia,
	createSocialMediaAction,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/create-social-media.action";
import type { ServerAction } from "@/lib/server/create-server-action";

async function fetchSocialMediaOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/social-media/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load social media options.");
	}

	return (await response.json()) as { items: Array<AsyncOption>; total: number };
}

interface ProjectFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	project?: Pick<
		schema.Project,
		"acronym" | "call" | "duration" | "funding" | "id" | "name" | "summary" | "topic"
	> & {
		descriptionContentBlocks?: Array<ContentBlock>;
		entityVersion: {
			entity: Pick<schema.Entity, "id" | "slug">;
			status: Pick<schema.EntityStatus, "id" | "type">;
		};
		scope: Pick<schema.ProjectScope, "id" | "scope">;
	} & { image: { key: string; label: string; url: string } | null };
	formAction: ServerAction;
	scopes: Array<Pick<schema.ProjectScope, "id" | "scope">>;
	initialSocialMediaItems: Array<AsyncOption>;
	initialSocialMediaTotal: number;
	selectedSocialMediaItems?: Array<AsyncOption>;
	initialSocialMediaIds?: Array<string>;
}

export function ProjectForm(props: Readonly<ProjectFormProps>): ReactNode {
	const {
		initialAssets,
		formAction,
		project,
		scopes,
		initialSocialMediaItems,
		initialSocialMediaTotal,
		selectedSocialMediaItems,
		initialSocialMediaIds,
	} = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedImage, setSelectedImage] = useState<{ key: string; url: string } | null>(
		project?.image ?? null,
	);
	const [imageKeyError, setImageKeyError] = useState(false);

	const [selectedSocialMediaIds, setSelectedSocialMediaIds] = useState<Array<string>>(
		initialSocialMediaIds ?? [],
	);

	const [localSocialMediaItems, setLocalSocialMediaItems] = useState<Array<AsyncOption>>(
		() => selectedSocialMediaItems ?? [],
	);

	const [isCreateSocialMediaOpen, setIsCreateSocialMediaOpen] = useState(false);
	const [createSocialMediaFormKey, setCreateSocialMediaFormKey] = useState(0);

	const [createSocialMediaState, setCreateSocialMediaState] = useState<
		ActionState<CreatedSocialMedia>
	>(() => createActionStateInitial());
	const [isCreateSocialMediaPending, startCreateSocialMediaTransition] = useTransition();

	function handleCreateSocialMedia(formData: FormData) {
		startCreateSocialMediaTransition(async () => {
			const result = await createSocialMediaAction(createSocialMediaState, formData);
			setCreateSocialMediaState(result);
			if (result.status === "success") {
				setLocalSocialMediaItems((prev) => [
					...prev,
					{
						description: `${result.data.type.type} · ${result.data.url}`,
						id: result.data.id,
						name: result.data.name,
					},
				]);
				setSelectedSocialMediaIds((prev) => [...prev, result.data.id]);
				setIsCreateSocialMediaOpen(false);
				setCreateSocialMediaFormKey((prev) => prev + 1);
			}
		});
	}

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Enter the project details.")} title={t("Details")}>
					<TextField defaultValue={project?.name} isRequired={true} name="name">
						<Label>{t("Name")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<TextField defaultValue={project?.acronym ?? undefined} name="acronym">
						<Label>{t("Acronym")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<NumberField
						defaultValue={project?.funding ?? undefined}
						formatOptions={{ currency: "EUR", style: "currency" }}
						name="funding"
					>
						<Label>{t("Funding")}</Label>
						<Input />
						<Description>{t("Enter the funding amount in euros.")}</Description>
						<FieldError />
					</NumberField>

					<TextField defaultValue={project?.topic ?? undefined} name="topic">
						<Label>{t("Topic")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<TextField defaultValue={project?.call ?? undefined} name="call">
						<Label>{t("Call")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<DatePicker
						defaultValue={
							project != null
								? new CalendarDate(
										project.duration.start.getUTCFullYear(),
										project.duration.start.getUTCMonth() + 1,
										project.duration.start.getUTCDate(),
									)
								: undefined
						}
						granularity="day"
						isRequired={true}
						name="duration.start"
					>
						<Label>{t("Start date")}</Label>
						<DatePickerTrigger />
						<FieldError />
					</DatePicker>

					<DatePicker
						defaultValue={
							project?.duration.end != null
								? new CalendarDate(
										project.duration.end.getUTCFullYear(),
										project.duration.end.getUTCMonth() + 1,
										project.duration.end.getUTCDate(),
									)
								: undefined
						}
						granularity="day"
						name="duration.end"
					>
						<Label>{t("End date")}</Label>
						<DatePickerTrigger />
						<FieldError />
					</DatePicker>

					<Select defaultValue={project?.scope.id ?? undefined} isRequired={true} name="scopeId">
						<Label>{t("Scope")}</Label>
						<SelectTrigger />
						<FieldError />
						<SelectContent>
							{scopes.map((item) => (
								<SelectItem key={item.id} id={item.id}>
									{item.scope}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<TextField defaultValue={project?.summary} isRequired={true} name="summary">
						<Label>{t("Summary")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				<FormSection description={t("Select or upload an image.")} title={t("Image")}>
					{selectedImage != null && (
						<img
							alt={t("Selected image")}
							className="block-24 inline-auto max-inline-full rounded-lg object-contain"
							src={selectedImage.url}
						/>
					)}
					<MediaLibraryDialog
						defaultPrefix="logos"
						initialAssets={initialAssets}
						onSelect={(key, url) => {
							setSelectedImage({ key, url });
							setImageKeyError(false);
						}}
						prefixes={["logos"]}
					/>
					{selectedImage != null ? (
						<Button
							intent="outline"
							onPress={() => {
								setSelectedImage(null);
								setImageKeyError(false);
							}}
						>
							{t("Remove image")}
						</Button>
					) : null}

					<input
						aria-hidden={true}
						className="sr-only"
						name="imageKey"
						onInvalid={(e) => {
							e.preventDefault();
							setImageKeyError(true);
						}}
						readOnly={true}
						// required={true}
						tabIndex={-1}
						value={selectedImage?.key ?? ""}
					/>
					{imageKeyError ? (
						<div className={fieldErrorStyles()}>{t("Please select an image.")}</div>
					) : null}
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Add a short description.")}
					title={t("Description")}
					variant="stacked"
				>
					<RichTextContentBlocksField
						aria-label={t("Description")}
						initialBlocks={project?.descriptionContentBlocks}
						initialAssets={initialAssets}
						name="description"
					/>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Link social media accounts to this project.")}
					title={t("Social media")}
				>
					<AsyncMultipleSelect
						aria-label={t("Social media")}
						fetchPage={fetchSocialMediaOptionsPage}
						initialItems={initialSocialMediaItems}
						initialTotal={initialSocialMediaTotal}
						onChange={setSelectedSocialMediaIds}
						placeholder={t("No social media linked")}
						selectedItems={localSocialMediaItems}
						value={selectedSocialMediaIds}
					/>
					<Button
						className="self-start"
						intent="outline"
						onPress={() => {
							setIsCreateSocialMediaOpen(true);
						}}
					>
						<PlusIcon />
						{t("Create social media")}
					</Button>
					{selectedSocialMediaIds.map((id, index) => (
						<input key={id} name={`socialMediaIds.${String(index)}`} type="hidden" value={id} />
					))}
				</FormSection>

				<ModalContent
					isOpen={isCreateSocialMediaOpen}
					onOpenChange={(open) => {
						setIsCreateSocialMediaOpen(open);
						if (!open) {
							setCreateSocialMediaFormKey((prev) => prev + 1);
						}
					}}
				>
					<Form
						key={createSocialMediaFormKey}
						action={handleCreateSocialMedia}
						state={createSocialMediaState}
					>
						<ModalHeader
							description={t("Fill in the details for the new social media entry.")}
							title={t("Create social media")}
						/>
						<ModalBody className="flex flex-col gap-y-4">
							<TextField isRequired={true} name="name">
								<Label>{t("Name")}</Label>
								<Input />
								<FieldError />
							</TextField>

							<TextField isRequired={true} name="url">
								<Label>{t("URL")}</Label>
								<Input placeholder="https://" />
								<FieldError />
							</TextField>

							<Select isRequired={true} name="type">
								<Label>{t("Type")}</Label>
								<SelectTrigger />
								<FieldError />
								<SelectContent>
									{socialMediaTypesEnum.map((type) => (
										<SelectItem key={type} id={type}>
											{type}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<DatePicker granularity="day" name="duration.start">
								<Label>{t("Start date (optional)")}</Label>
								<DatePickerTrigger />
							</DatePicker>

							<DatePicker granularity="day" name="duration.end">
								<Label>{t("End date (optional)")}</Label>
								<DatePickerTrigger />
							</DatePicker>
						</ModalBody>
						<ModalFooter>
							<ModalClose>{t("Cancel")}</ModalClose>
							<Button isPending={isCreateSocialMediaPending} type="submit">
								{isCreateSocialMediaPending ? (
									<Fragment>
										<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
										<span aria-hidden={true}>{t("Saving...")}</span>
									</Fragment>
								) : (
									t("Create")
								)}
							</Button>
						</ModalFooter>
						<FormStatus className="px-6 pbe-4" state={createSocialMediaState} />
					</Form>
				</ModalContent>

				{project != null ? (
					<Fragment>
						<input name="id" type="hidden" value={project.id} />
						<input name="documentId" type="hidden" value={project.entityVersion.entity.id} />
					</Fragment>
				) : null}

				<EntityFormActions entityName={t("Project")} isPending={isPending} state={state} />
			</Form>
		</FormLayout>
	);
}
