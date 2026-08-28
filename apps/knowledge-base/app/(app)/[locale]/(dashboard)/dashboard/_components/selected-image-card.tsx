"use client";

import { Button } from "@dariah-eric/ui/button";
import { buttonStyles } from "@dariah-eric/ui/button-styles";
import { toPlainText } from "@dariah-eric/ui/rich-text";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import {
	AssetSummary,
	type SelectedImage,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/asset-summary";
import {
	EditAssetMetadataDialog,
	type SavedAssetMetadata,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_components/edit-asset-metadata-dialog";

export type { SelectedImage };

interface SelectedImageCardProps {
	image: SelectedImage;
	/**
	 * Applies metadata just saved through the card's own edit dialog, so the card reflects the asset
	 * without a page reload. Omit it to hide the edit action.
	 */
	onMetadataChange?: (image: SelectedImage) => void;
	/** Picker, remove button, and anything else specific to the surrounding field. */
	children?: ReactNode;
	/**
	 * Settings that belong to this placement of the asset rather than to the asset itself - the
	 * caption controls. Rendered inside the card, below a divider, so they read as part of the image
	 * field instead of competing with the form's own actions.
	 */
	footer?: ReactNode;
}

/**
 * Identifies a picked asset: what it is called, what it already says, and how to correct that. The
 * same card backs every asset field in the dashboard - featured images, logos, portraits, and the
 * document pickers - so an asset reads the same wherever it is chosen.
 */
export function SelectedImageCard(props: Readonly<SelectedImageCardProps>): ReactNode {
	const { children, footer, image, onMetadataChange } = props;

	const t = useExtracted();

	const hasCaption = image.caption != null && toPlainText(image.caption) !== "";

	function handleSaved(saved: SavedAssetMetadata) {
		/**
		 * The dialog can only name a license once its option list has loaded, and it loads that list
		 * lazily - saving before it arrives reports the id without the label. An unchanged id means the
		 * label already on screen still describes it, so keep it rather than blanking the line.
		 */
		const license =
			saved.licenseId === image.licenseId
				? (saved.license ?? image.license ?? null)
				: saved.license;

		onMetadataChange?.({ ...image, ...saved, license });
	}

	return (
		<div className="flex flex-col gap-y-4 rounded-lg border border-border p-3">
			<AssetSummary caption={hasCaption ? toPlainText(image.caption) : undefined} image={image} />

			<div className="flex flex-row flex-wrap items-center gap-2">
				{children}

				{image.id != null && onMetadataChange != null ? (
					<EditAssetMetadataDialog
						asset={{
							id: image.id,
							key: image.key,
							label: image.label ?? image.key,
							alt: image.alt ?? null,
							caption: image.caption ?? null,
							licenseId: image.licenseId ?? null,
							mimeType: image.mimeType ?? "",
							width: image.width,
							height: image.height,
							url: image.url,
						}}
						onSuccess={handleSaved}
						trigger={({ open }) => (
							<Button intent="outline" onPress={open}>
								{t("Edit metadata")}
							</Button>
						)}
					/>
				) : null}

				{/* The preview above is a resized derivative; this serves the original bytes. */}
				<a
					className={buttonStyles({ intent: "plain" })}
					download={true}
					href={`/api/assets/download?key=${encodeURIComponent(image.key)}`}
				>
					<ArrowDownTrayIcon aria-hidden={true} className="block-4 inline-4" />
					{t("Download original")}
				</a>
			</div>

			{footer != null ? <div className="border-bs border-border pbs-4">{footer}</div> : null}
		</div>
	);
}
