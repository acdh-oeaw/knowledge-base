import { imageCaptionModesEnum } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { RichTextCaptionColumnSchema } from "@/lib/rich-text-caption";

export const ImageCaptionModeSchema = v.picklist(imageCaptionModesEnum);

/**
 * How the caption of an entity's own image behaves, as posted by `ImageSelectField`.
 *
 * The caption is kept even while the mode is not `override`, so switching to "use asset caption"
 * and back does not silently discard what an author already wrote.
 */
export const FeaturedImageCaptionInputSchema = {
	imageCaption: RichTextCaptionColumnSchema,
	imageCaptionMode: v.optional(ImageCaptionModeSchema, "inherit"),
};

/**
 * Form input for the featured image of an entity: which asset it points at, plus its caption
 * behaviour. For entities whose image is optional, pair {@link FeaturedImageCaptionInputSchema} with
 * the entity's own `imageKey` rule instead.
 */
export const FeaturedImageInputSchema = {
	imageKey: v.pipe(v.string(), v.nonEmpty()),
	...FeaturedImageCaptionInputSchema,
};
