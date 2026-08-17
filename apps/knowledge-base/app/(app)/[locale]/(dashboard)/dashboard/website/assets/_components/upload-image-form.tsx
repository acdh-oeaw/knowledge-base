"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { SubmitButton } from "@dariah-eric/ui/submit-button";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState, useState } from "react";

import { uploadImageAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/upload-image.action";
import { imageSizeLimit } from "@/config/assets.config";
import { formatFileSize } from "@/lib/format-file-size";

export function UploadImageForm(): ReactNode {
	const t = useExtracted();

	const [state, action] = useActionState(uploadImageAction, createActionStateInitial());
	const [fileError, setFileError] = useState<string | null>(null);

	return (
		<Form action={action} className="grid gap-y-6" state={state}>
			<FormStatus state={state} />

			<label>
				<div>{t("Select an image to upload")}</div>
				<input
					accept="image/png, image/jpeg"
					name="file"
					onChange={(event) => {
						const file = event.target.files?.[0];
						if (file != null && file.size > imageSizeLimit) {
							event.target.value = "";
							setFileError(
								t("The selected image is too large. Choose an image smaller than {size}.", {
									size: formatFileSize(imageSizeLimit),
								}),
							);
							return;
						}
						setFileError(null);
					}}
					required={true}
					type="file"
				/>
			</label>
			{fileError != null ? (
				<p className="text-danger text-sm" role="alert">
					{fileError}
				</p>
			) : null}

			<div>
				<SubmitButton isDisabled={fileError != null}>{t("Upload image")}</SubmitButton>
			</div>
		</Form>
	);
}
