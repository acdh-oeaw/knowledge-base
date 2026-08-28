import type { JSONContent } from "@tiptap/core";

import type { imageCaptionModesEnum } from "./schema/image-captions";

export type ImageCaptionMode = (typeof imageCaptionModesEnum)[number];
export type ImageCaptionSource = "asset" | "block" | null;

interface ResolveImageCaptionParams {
	assetCaption: JSONContent | null | undefined;
	blockCaption: JSONContent | null | undefined;
	captionMode: ImageCaptionMode;
}

/** Resolve the caption displayed for one placement without materialising inherited asset data. */
export function resolveImageCaption({
	assetCaption,
	blockCaption,
	captionMode,
}: Readonly<ResolveImageCaptionParams>): {
	caption: JSONContent | null;
	source: ImageCaptionSource;
} {
	if (captionMode === "hidden") {
		return { caption: null, source: null };
	}

	if (captionMode === "override") {
		return {
			caption: blockCaption ?? null,
			source: blockCaption != null ? "block" : null,
		};
	}

	return {
		caption: assetCaption ?? null,
		source: assetCaption != null ? "asset" : null,
	};
}
