"use client";

import { Button } from "@dariah-eric/ui/button";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useState, useTransition } from "react";

import { AssetPreview } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/asset-preview";
import { mergeDuplicateAssetsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/merge-duplicate-assets.action";
import type { DuplicateAssetPreviewGroup } from "@/lib/data/asset-deduplication";
import { formatFileSize } from "@/lib/format-file-size";
import { useRouter } from "@/lib/navigation/navigation";

interface DuplicateAssetsProps {
	groups: Array<DuplicateAssetPreviewGroup>;
}

export function DuplicateAssets({ groups }: Readonly<DuplicateAssetsProps>): ReactNode {
	const t = useExtracted();
	const router = useRouter();
	const [canonicalIds, setCanonicalIds] = useState<Record<string, string>>(() =>
		Object.fromEntries(groups.map((group) => [group.fingerprint, group.assets[0]!.id])),
	);
	const [merging, setMerging] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isRefreshing, startRefreshTransition] = useTransition();

	if (groups.length === 0) {
		return <p className="my-8 text-sm text-muted-fg">{t("No duplicate images found.")}</p>;
	}

	async function merge(group: DuplicateAssetPreviewGroup) {
		const canonicalId = canonicalIds[group.fingerprint] ?? group.assets[0]!.id;
		setMerging(group.fingerprint);
		setError(null);
		try {
			await mergeDuplicateAssetsAction(
				canonicalId,
				group.assets.filter((asset) => asset.id !== canonicalId).map((asset) => asset.id),
			);
			startRefreshTransition(() => {
				router.refresh();
			});
		} catch {
			setError(t("Could not merge the duplicate images. Please try again."));
		} finally {
			setMerging(null);
		}
	}

	return (
		<div className="flex flex-col gap-y-(--layout-padding)">
			<p className="text-sm text-muted-fg">
				{t("{count} groups of binary-identical images found.", { count: String(groups.length) })}
			</p>
			{error != null ? (
				<p className="text-sm text-danger" role="alert">
					{error}
				</p>
			) : null}
			{groups.map((group) => {
				const canonicalId = canonicalIds[group.fingerprint] ?? group.assets[0]!.id;
				const references = group.assets.reduce(
					(total, asset) => total + asset.foreignKeyReferences + asset.jsonReferences,
					0,
				);
				return (
					<section className="rounded-lg border p-4" key={group.fingerprint}>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<p className="text-sm font-medium">
								{t("{count} copies · {size} each · {references} references", {
									count: String(group.assets.length),
									size: formatFileSize(group.assets[0]!.size),
									references: String(references),
								})}
							</p>
							<Button
								isDisabled={merging != null || isRefreshing}
								onPress={() => void merge(group)}
							>
								{merging === group.fingerprint ? (
									<Fragment>
										<ProgressCircle aria-label={t("Merging...")} isIndeterminate={true} />
										{t("Merging...")}
									</Fragment>
								) : (
									t("Use selected image")
								)}
							</Button>
						</div>
						<div className="grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-3 mbs-4">
							{group.assets.map((asset) => (
								<label
									className="flex cursor-pointer gap-3 rounded-md border p-2 has-checked:border-accent"
									key={asset.id}
								>
									<input
										checked={canonicalId === asset.id}
										name={`canonical-${group.fingerprint}`}
										onChange={() => {
											setCanonicalIds((current) => {
												return { ...current, [group.fingerprint]: asset.id };
											});
										}}
										type="radio"
									/>
									<AssetPreview
										alt={asset.label}
										className="shrink-0 overflow-hidden rounded-sm block-20 inline-20"
										imageClassName="object-contain"
										mimeType={asset.mimeType}
										src={asset.url}
										storageKey={asset.key}
									/>
									<span className="min-inline-0 text-sm">
										<span className="line-clamp-2 font-medium">{asset.label}</span>
										<span className="block truncate text-xs text-muted-fg" title={asset.key}>
											{asset.key}
										</span>
										<span className="text-xs text-muted-fg">
											{t("{count} references", {
												count: String(asset.foreignKeyReferences + asset.jsonReferences),
											})}
										</span>
									</span>
								</label>
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}
