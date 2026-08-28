"use client";

import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";

import {
	type SelectedImage,
	SelectedImageCard,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/selected-image-card";

interface BlockAssetMetadataProps {
	assetKey: string;
	/**
	 * Reports metadata saved through the card, so the block can refresh the asset data it keeps
	 * alongside the key - the alt text it renders, and the caption it inherits.
	 */
	onMetadataChange?: (metadata: { alt: string | null; caption: JSONContent | null }) => void;
}

/**
 * The asset card for a richtext block, which stores only a storage key. The asset is read when the
 * block's panel opens, so an author editing a block sees what the asset currently says - and can
 * correct it - without leaving the editor.
 */
export function BlockAssetMetadata(props: Readonly<BlockAssetMetadataProps>): ReactNode {
	const { assetKey, onMetadataChange } = props;

	const t = useExtracted();
	const [asset, setAsset] = useState<SelectedImage | null>(null);
	const [isMissing, setIsMissing] = useState(false);

	useEffect(() => {
		const controller = new AbortController();

		async function fetchAsset() {
			setIsMissing(false);

			const response = await fetch(`/api/assets/by-key?key=${encodeURIComponent(assetKey)}`, {
				signal: controller.signal,
			});

			if (!response.ok) {
				setAsset(null);
				setIsMissing(true);
				return;
			}

			const data = (await response.json()) as { asset: SelectedImage };
			setAsset(data.asset);
		}

		void fetchAsset().catch(() => {
			/** An aborted request is the effect cleaning up after itself, not a failure to report. */
			if (!controller.signal.aborted) {
				setIsMissing(true);
			}
		});

		return () => {
			controller.abort();
		};
	}, [assetKey]);

	if (isMissing) {
		return (
			<p className="text-xs text-muted-fg">{t("This image is no longer in the media library.")}</p>
		);
	}

	if (asset == null) {
		return (
			<div className="flex items-center gap-x-2 text-sm text-muted-fg">
				<ProgressCircle aria-label={t("Loading...")} isIndeterminate={true} />
				<span>{t("Loading...")}</span>
			</div>
		);
	}

	return (
		<SelectedImageCard
			image={asset}
			onMetadataChange={(saved) => {
				setAsset(saved);
				onMetadataChange?.({ alt: saved.alt ?? null, caption: saved.caption ?? null });
			}}
		/>
	);
}
