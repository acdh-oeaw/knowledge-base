"use client";

import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { AssetPreview } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/asset-preview";
import { formatDimensions } from "@/lib/format-dimensions";
import { formatFileSize } from "@/lib/format-file-size";

/**
 * A picked asset as an editing screen knows it. Only `key` and `url` are needed to submit and
 * preview the selection; the rest is metadata the summary surfaces so authors can see - and correct
 * - what they picked without leaving the form.
 */
export interface SelectedImage {
	key: string;
	url: string;
	id?: string | null;
	label?: string | null;
	alt?: string | null;
	caption?: JSONContent | null;
	license?: { code: string; name: string } | null;
	licenseId?: string | null;
	mimeType?: string | null;
	size?: number | null;
	/** Absent for vectors and for assets whose dimensions have not been measured yet. */
	width?: number | null;
	height?: number | null;
}

interface AssetSummaryProps {
	image: SelectedImage;
	/**
	 * What the caption line reads. Callers decide which caption applies - the asset's own on an
	 * editing screen, the one a placement resolves to on a details screen - and pass nothing when
	 * there is none.
	 */
	caption?: ReactNode;
}

/**
 * Identifies an asset: a preview, what it is called, what it already says, and what kind of file it
 * is. The preview sits above the metadata rather than beside it, so it can use the full width of
 * whatever holds it and long labels get a line of their own instead of being truncated.
 */
export function AssetSummary(props: Readonly<AssetSummaryProps>): ReactNode {
	const { caption, image } = props;

	const t = useExtracted();

	/**
	 * Alt text and captions describe a picture. A document (a PDF policy, say) carries the columns
	 * too, but they are never rendered for it, so showing them here would only invite filling in
	 * something nobody reads.
	 */
	const isImage = image.mimeType == null || image.mimeType.startsWith("image/");

	/** The file's identity, as the assets page states it in its list view. */
	const fileDetails = [
		image.license?.code,
		image.mimeType,
		formatDimensions(image.width, image.height),
		image.size != null ? formatFileSize(image.size) : null,
	].filter((detail) => detail != null && detail !== "");

	return (
		<div className="flex flex-col gap-y-3">
			<div className="flex items-center justify-center overflow-hidden rounded-md bg-muted block-56">
				<AssetPreview
					alt={image.alt ?? image.label ?? t("Selected image")}
					className="block-full inline-full"
					imageClassName="object-contain"
					kindLabelClassName="bg-background/90 text-xs"
					mimeType={image.mimeType ?? undefined}
					src={image.url}
					storageKey={image.key}
				/>
			</div>

			<div className="flex flex-col gap-y-1.5">
				<span className="text-sm/tight font-medium">{image.label ?? image.key}</span>

				{isImage ? (
					<Fragment>
						<span className="line-clamp-2 text-xs text-muted-fg">
							<span className="font-medium">{t("Alt text")}:</span>{" "}
							{image.alt != null && image.alt !== "" ? image.alt : "—"}
						</span>

						{/* A div, because a rendered richtext caption is not an inline element. */}
						<div className="line-clamp-2 text-xs text-muted-fg">
							<span className="font-medium">{t("Caption")}:</span> {caption ?? "—"}
						</div>
					</Fragment>
				) : null}

				{fileDetails.length > 0 ? (
					<div className="flex flex-row flex-wrap items-center gap-x-1.5 text-xs text-muted-fg">
						{fileDetails.map((detail, index) => (
							<Fragment key={detail}>
								{index > 0 ? <span aria-hidden={true}>{"·"}</span> : null}
								<span>{detail}</span>
							</Fragment>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}
