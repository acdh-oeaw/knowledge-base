/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as p from "drizzle-orm/pg-core";

/**
 * How one placement of an image decides which caption to show: inherit the asset's own caption,
 * override it for this placement only, or show none. The caption belongs to the asset, so a
 * placement never edits it — it either takes it, replaces it locally, or suppresses it.
 */
export const imageCaptionModesEnum = ["hidden", "inherit", "override"] as const;

/** The `caption_mode` column shared by every image placement (content blocks, featured images). */
export function imageCaptionModeColumn(name: string) {
	return p.text(name, { enum: imageCaptionModesEnum }).notNull().default("inherit");
}
