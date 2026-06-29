"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { socialMediaTypesEnum } from "@acdh-knowledge-base/database/schema";
import { type ActionState, createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { AsyncMultipleSelect } from "@acdh-knowledge-base/ui/async-multiple-select";
import { Button } from "@acdh-knowledge-base/ui/button";
import { DatePicker, DatePickerTrigger } from "@acdh-knowledge-base/ui/date-picker";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
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
import { ProgressCircle } from "@acdh-knowledge-base/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@acdh-knowledge-base/ui/select";
import { Separator } from "@acdh-knowledge-base/ui/separator";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import type {
	AsyncOption,
	AsyncOptionsFetchPageParams,
} from "@acdh-knowledge-base/ui/use-async-options";
import { PlusIcon } from "@heroicons/react/20/solid";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState, useTransition } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { ImageSelectField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { RichTextContentBlocksField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/rich-text-content-blocks-field";
import {
	type CreatedSocialMedia,
	createSocialMediaAction,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/create-social-media.action";
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

interface PersonFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	person?: Pick<schema.Person, "email" | "id" | "name" | "orcid" | "sortName"> & {
		biographyContentBlocks?: Array<ContentBlock>;
		entityVersion: { entity: { id: string; slug: string } };
	} & { image: { key: string; label: string; url: string } | null };
	initialSocialMediaItems: Array<AsyncOption>;
	initialSocialMediaTotal: number;
	selectedSocialMediaItems?: Array<AsyncOption>;
	initialSocialMediaIds?: Array<string>;
	formAction: ServerAction;
}

export function PersonForm(props: Readonly<PersonFormProps>): ReactNode {
	const {
		initialAssets,
		formAction,
		person,
		initialSocialMediaItems,
		initialSocialMediaTotal,
		selectedSocialMediaItems,
		initialSocialMediaIds,
	} = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedImage, setSelectedImage] = useState<{ key: string; url: string } | null>(
		person?.image ?? null,
	);

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
				<Separator className="my-6" />

				<FormSection
					description={t("Link social media accounts to this person.")}
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
