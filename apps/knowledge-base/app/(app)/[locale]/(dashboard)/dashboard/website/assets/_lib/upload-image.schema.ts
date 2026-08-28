import * as v from "valibot";

import { documentMimeTypes, imageMimeTypes, imageSizeLimit } from "@/config/assets.config";
import { assetPrefixes } from "@/lib/data/assets";
import { formatFileSize } from "@/lib/format-file-size";
import { RichTextCaptionFormSchema } from "@/lib/rich-text-caption";

const OptionalLicenseSchema = v.pipe(
	v.optional(v.string()),
	v.transform((value) => (value != null && value !== "" && value !== "none" ? value : undefined)),
);

export const UploadImageInputSchema = v.pipe(
	v.object({
		file: v.pipe(
			v.file(),
			v.check(
				(input) => input.size <= imageSizeLimit,
				`The selected file is too large. Choose a file smaller than ${formatFileSize(
					imageSizeLimit,
				)}.`,
			),
		),
		licenseId: OptionalLicenseSchema,
		prefix: v.picklist(assetPrefixes),
		label: v.optional(v.pipe(v.string(), v.nonEmpty())),
		caption: RichTextCaptionFormSchema,
		alt: v.optional(v.pipe(v.string(), v.nonEmpty())),
	}),
	v.forward(
		v.check((input) => {
			const acceptedFileTypes = input.prefix === "documents" ? documentMimeTypes : imageMimeTypes;

			return acceptedFileTypes.some((mimeType) => mimeType === input.file.type);
		}, "Select a supported file type."),
		["file"],
	),
);
