import { type ImageCaptionMode, resolveImageCaption } from "@dariah-eric/database/image-captions";
import { InlineRichTextRenderer } from "@dariah-eric/ui/inline-rich-text-renderer";
import { isEmptyRichTextDocument } from "@dariah-eric/ui/rich-text";
import type { JSONContent } from "@tiptap/core";
import type { ReactNode } from "react";

import {
	AssetSummary,
	type SelectedImage,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/asset-summary";

interface FeaturedImageDetailsProps {
	image: SelectedImage;
	/** The entity's own caption for this placement, shown when it overrides the asset's. */
	imageCaption?: JSONContent | null;
	imageCaptionMode?: ImageCaptionMode;
}

/**
 * A featured image as the website will render it: the picture, what the asset is, and the caption
 * the entity's caption mode resolves to. Details views exist so an editor can check what was saved,
 * so they apply the same resolution the API does rather than showing the asset's caption regardless
 * - or, as before, no caption at all. The same summary backs the editing screens, minus their
 * controls, so an image reads the same before and after saving.
 */
export function FeaturedImageDetails(props: Readonly<FeaturedImageDetailsProps>): ReactNode {
	const { image, imageCaption, imageCaptionMode } = props;

	const { caption } = resolveImageCaption({
		assetCaption: image.caption,
		blockCaption: imageCaption,
		/** Rows written before the column existed carry the mode implicitly, as everywhere else. */
		captionMode: imageCaptionMode ?? (imageCaption != null ? "override" : "inherit"),
	});

	return (
		<AssetSummary
			caption={
				!isEmptyRichTextDocument(caption) ? (
					<InlineRichTextRenderer
						className="inline text-xs text-muted-fg [&_p]:m-0 [&_p]:inline"
						content={caption!}
					/>
				) : undefined
			}
			image={image}
		/>
	);
}
