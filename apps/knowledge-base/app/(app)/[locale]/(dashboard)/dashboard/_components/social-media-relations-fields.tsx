"use client";

import { socialMediaTypesEnum } from "@dariah-eric/database/schema";
import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { AsyncMultipleSelect } from "@dariah-eric/ui/async-multiple-select";
import { Button } from "@dariah-eric/ui/button";
import { DatePicker, DatePickerTrigger } from "@dariah-eric/ui/date-picker";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import {
	ModalBody,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@dariah-eric/ui/modal";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { TextField } from "@dariah-eric/ui/text-field";
import type { AsyncOption, AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
import { PlusIcon } from "@heroicons/react/20/solid";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useState, useTransition } from "react";

import { FormSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import {
	type CreatedSocialMedia,
	createSocialMediaAction,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/create-social-media.action";

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

interface SocialMediaRelationsFieldsProps {
	description: string;
	initialSocialMediaIds?: Array<string>;
	initialSocialMediaItems: Array<AsyncOption>;
	initialSocialMediaTotal: number;
	selectedSocialMediaItems?: Array<AsyncOption>;
}

export function SocialMediaRelationsFields(
	props: Readonly<SocialMediaRelationsFieldsProps>,
): ReactNode {
	const {
		description,
		initialSocialMediaIds,
		initialSocialMediaItems,
		initialSocialMediaTotal,
		selectedSocialMediaItems,
	} = props;

	const t = useExtracted();

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
		<FormSection description={description} title={t("Social media")}>
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
		</FormSection>
	);
}
