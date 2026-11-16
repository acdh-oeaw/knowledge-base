import * as v from "valibot";

import { RichTextCaptionColumnSchema } from "@/lib/rich-text-caption";

/**
 * `getFormDataValues` drops empty inputs, so a field the author cleared arrives missing. This form
 * always submits the whole row, so missing means "cleared" and is stored as `null` — defaulting to
 * `""` keeps the field in the parsed input instead of letting it fall out and leave the column
 * untouched.
 */
const OptionalTextSchema = v.pipe(
	v.optional(v.string(), ""),
	v.transform((value) => {
		const trimmed = value.trim();

		return trimmed !== "" ? trimmed : null;
	}),
);

/**
 * `"x,y"` sets the point, `"none"` clears it (see `formatFocalPointInput`). Missing means the
 * dialog did not know the asset's current point and so rendered no picker — the column is left
 * untouched rather than reset to the centre behind the editor's back.
 */
const FocalPointInputSchema = v.optional(
	v.union([
		v.pipe(
			v.literal("none"),
			v.transform(() => null),
		),
		v.pipe(
			v.string(),
			v.regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?),(?:0(?:\.\d+)?|1(?:\.0+)?)$/),
			v.transform((value) => {
				const [x, y] = value.split(",").map(Number) as [number, number];

				return { x, y };
			}),
		),
	]),
);

const OptionalLicenseSchema = v.pipe(
	v.optional(v.string(), ""),
	v.transform((value) => (value !== "" && value !== "none" ? value : null)),
);

export const UpdateAssetMetadataInputSchema = v.object({
	id: v.pipe(v.string(), v.nonEmpty()),
	label: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	alt: OptionalTextSchema,
	caption: RichTextCaptionColumnSchema,
	licenseId: OptionalLicenseSchema,
	focalPoint: FocalPointInputSchema,
});
