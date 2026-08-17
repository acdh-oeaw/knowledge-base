"use client";

import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
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
import { TextArea } from "@dariah-eric/ui/textarea";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import { AssetPreview } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/asset-preview";
import { updateAssetMetadataAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/update-asset-metadata.action";

interface AssetMetadataItem {
	id: string;
	key: string;
	label: string;
	alt: string | null;
	caption: string | null;
	licenseId: string | null;
	mimeType: string;
	url: string;
}

interface EditAssetMetadataDialogProps {
	asset: AssetMetadataItem;
	licenses: Array<{ id: string; code: string; name: string }>;
	onSuccess: () => void;
	triggerClassName?: string;
}

export function EditAssetMetadataDialog(props: Readonly<EditAssetMetadataDialogProps>): ReactNode {
	const {
		asset,
		licenses,
		onSuccess,
		triggerClassName = "absolute inset-bs-2 inset-e-2 bg-bg",
	} = props;

	const t = useExtracted();
	const [isOpen, setIsOpen] = useState(false);

	const [state, formAction, isPending] = useActionState(
		async (prevState: ActionState, formData: FormData) => {
			const result = await updateAssetMetadataAction(prevState, formData);

			if (result.status === "success") {
				setIsOpen(false);
				onSuccess();
			}

			return result;
		},
		createActionStateInitial(),
	);

	return (
		<Fragment>
			<Button
				aria-label={t("Edit metadata")}
				className={triggerClassName}
				intent="plain"
				onPress={() => {
					setIsOpen(true);
				}}
				size="sq-sm"
			>
				<PencilSquareIcon aria-hidden={true} className="block-4 inline-4" />
			</Button>

			<ModalContent isOpen={isOpen} onOpenChange={setIsOpen} size="lg">
				<Form action={formAction} state={state}>
					<ModalHeader
						description={t("Update label, alt text, and caption for this asset.")}
						title={t("Edit asset metadata")}
					/>

					<ModalBody className="flex flex-col gap-y-5">
						<FormStatus state={state} />

						<input name="id" type="hidden" value={asset.id} />

						<div className="overflow-hidden rounded-lg bg-muted aspect-video">
							<AssetPreview
								alt={asset.alt ?? asset.label}
								className="block-full inline-full"
								imageClassName="object-contain"
								kindLabelClassName="bg-background/90 text-xs"
								mimeType={asset.mimeType}
								src={asset.url}
								storageKey={asset.key}
							/>
						</div>

						<TextField defaultValue={asset.label} isRequired={true} name="label">
							<Label>{t("Label")}</Label>
							<Input />
							<FieldError />
						</TextField>

						<TextField defaultValue={asset.alt ?? ""} name="alt">
							<Label>{t("Alt text")}</Label>
							<Input placeholder={t("Describe the image for accessibility")} />
							<FieldError />
						</TextField>

						<TextField defaultValue={asset.caption ?? ""} name="caption">
							<Label>{t("Caption")}</Label>
							<TextArea placeholder={t("Optional caption displayed below the image")} rows={3} />
							<FieldError />
						</TextField>

						<Select defaultValue={asset.licenseId ?? "none"} name="licenseId">
							<Label>{t("License")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								<SelectItem id="none">{t("No license")}</SelectItem>
								{licenses.map((license) => (
									<SelectItem key={license.id} id={license.id}>
										{license.code} - {license.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</ModalBody>

					<ModalFooter>
						<ModalClose>{t("Cancel")}</ModalClose>

						<Button isPending={isPending} type="submit">
							{isPending ? (
								<Fragment>
									<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
									<span aria-hidden={true}>{t("Saving...")}</span>
								</Fragment>
							) : (
								t("Save")
							)}
						</Button>
					</ModalFooter>
				</Form>
			</ModalContent>
		</Fragment>
	);
}
