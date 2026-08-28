"use client";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label, labelStyles } from "@dariah-eric/ui/field";
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
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { type ComponentType, Fragment, type ReactNode, useActionState, useState } from "react";
import * as v from "valibot";

import { AssetPreview } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/asset-preview";
import { CaptionField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/caption-field";
import { updateAssetMetadataAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/update-asset-metadata.action";
import { UpdateAssetMetadataInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/update-asset-metadata.schema";
import { formatDimensions } from "@/lib/format-dimensions";

interface AssetMetadataItem {
	id: string;
	key: string;
	label: string;
	alt: string | null;
	caption: JSONContent | null;
	licenseId: string | null;
	mimeType: string;
	/**
	 * Stated under the preview, never edited: the dimensions describe the stored file, and the only
	 * way to change them is to upload a different one. Absent for vectors and for assets whose
	 * dimensions have not been measured yet.
	 */
	width?: number | null;
	height?: number | null;
	url: string;
}

/** The metadata as it was saved, so callers holding a copy of the asset can update it in place. */
export interface SavedAssetMetadata {
	label: string;
	alt: string | null;
	caption: JSONContent | null;
	licenseId: string | null;
	license: { code: string; name: string } | null;
}

interface LicenseOption {
	id: string;
	code: string;
	name: string;
}

interface EditAssetMetadataDialogProps {
	asset: AssetMetadataItem;
	/**
	 * License options for the select. Omit it where the page has no server-loaded licenses at hand —
	 * the dialog then fetches them the first time it is opened.
	 */
	licenses?: Array<LicenseOption>;
	onSuccess: (saved: SavedAssetMetadata) => void;
	/** Replaces the default icon-only trigger button. */
	trigger?: ComponentType<{ open: () => void }>;
	triggerClassName?: string;
}

export function EditAssetMetadataDialog(props: Readonly<EditAssetMetadataDialogProps>): ReactNode {
	const {
		asset,
		licenses,
		onSuccess,
		trigger,
		triggerClassName = "absolute inset-bs-2 inset-e-2 bg-bg",
	} = props;

	const t = useExtracted();
	const [isOpen, setIsOpen] = useState(false);
	const [fetchedLicenses, setFetchedLicenses] = useState<Array<LicenseOption> | null>(null);

	const licenseOptions = licenses ?? fetchedLicenses;
	const dimensions = formatDimensions(asset.width, asset.height);

	const [state, formAction, isPending] = useActionState(
		async (prevState: ActionState, formData: FormData) => {
			const result = await updateAssetMetadataAction(prevState, formData);

			if (result.status === "success") {
				setIsOpen(false);
				/**
				 * The action reports success but not the stored row, so the saved values are recovered by
				 * parsing the submitted form exactly as the action did - same schema, same normalization -
				 * rather than by reimplementing what it stored.
				 */
				const saved = v.safeParse(UpdateAssetMetadataInputSchema, getFormDataValues(formData));

				if (saved.success) {
					const license = licenseOptions?.find((option) => option.id === saved.output.licenseId);

					onSuccess({
						...saved.output,
						license: license != null ? { code: license.code, name: license.name } : null,
					});
				}
			}

			return result;
		},
		createActionStateInitial(),
	);

	function handleOpen() {
		setIsOpen(true);

		if (licenses == null && fetchedLicenses == null) {
			void (async () => {
				const response = await fetch("/api/licenses");
				const data = (await response.json()) as { items: Array<LicenseOption> };
				setFetchedLicenses(data.items);
			})();
		}
	}

	const Trigger = trigger;

	return (
		<Fragment>
			{Trigger != null ? (
				<Trigger open={handleOpen} />
			) : (
				<Button
					aria-label={t("Edit metadata")}
					className={triggerClassName}
					intent="plain"
					onPress={handleOpen}
					size="sq-sm"
				>
					<PencilSquareIcon aria-hidden={true} className="block-4 inline-4" />
				</Button>
			)}

			<ModalContent isOpen={isOpen} onOpenChange={setIsOpen} size="lg">
				<Form action={formAction} state={state}>
					<ModalHeader
						description={t("Update label, alt text, and caption for this asset.")}
						title={t("Edit asset metadata")}
					/>

					<ModalBody className="flex flex-col gap-y-5">
						<FormStatus state={state} />

						<input name="id" type="hidden" value={asset.id} />

						{/* Holds its aspect ratio instead of shrinking: the body is a flex column, so on a
						    short viewport the preview is the one child with nothing to keep it from being
						    squashed to a letterbox — in the dialog where you write this image's alt text.
						    Scrolling the body is the better trade. */}
						<div className="flex shrink-0 flex-col gap-y-1.5">
							<div className="aspect-video shrink-0 overflow-hidden rounded-lg bg-muted">
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

							{dimensions != null ? (
								<span className="text-xs text-muted-fg">
									<span className="font-medium">{t("Dimensions")}:</span> {dimensions}
								</span>
							) : null}
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

						<CaptionField defaultValue={asset.caption} name="caption" />

						{licenseOptions != null ? (
							<Select defaultValue={asset.licenseId ?? "none"} name="licenseId">
								<Label>{t("License")}</Label>
								<SelectTrigger />
								<FieldError />
								<SelectContent>
									<SelectItem id="none">{t("No license")}</SelectItem>
									{licenseOptions.map((license) => (
										<SelectItem key={license.id} id={license.id}>
											{license.code} - {license.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							/* The options are still loading. The current license travels in a hidden input so
							   submitting early keeps it instead of clearing it. */
							<div className="flex flex-col gap-y-1">
								<span className={labelStyles()}>{t("License")}</span>
								<div className="flex items-center gap-x-2 text-sm text-muted-fg">
									<ProgressCircle aria-label={t("Loading...")} isIndeterminate={true} />
									<span>{t("Loading...")}</span>
								</div>
								<input name="licenseId" type="hidden" value={asset.licenseId ?? "none"} />
							</div>
						)}
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
