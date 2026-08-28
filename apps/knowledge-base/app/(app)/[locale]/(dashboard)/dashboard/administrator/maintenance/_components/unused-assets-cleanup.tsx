"use client";

import { Button } from "@dariah-eric/ui/button";
import { Checkbox } from "@dariah-eric/ui/checkbox";
import { GridList, GridListItem } from "@dariah-eric/ui/grid-list";
import { Modal, ModalClose, ModalContent, ModalFooter, ModalHeader } from "@dariah-eric/ui/modal";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import cn from "clsx/lite";
import { AlertTriangleIcon, DownloadIcon, ExpandIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useState, useTransition } from "react";
import type { Selection } from "react-aria-components";

import { AssetPreview } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/asset-preview";
import { Paginate } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/paginate";
import { deleteUnusedAssetsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/delete-unused-assets.action";
import { useClientPagination } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/use-client-pagination";
import type { DeleteUnusedAssetsResult, UnusedAssetPreview } from "@/lib/data/asset-cleanup";
import { formatFileSize } from "@/lib/format-file-size";
import { useRouter } from "@/lib/navigation/navigation";

interface UnusedAssetsCleanupProps {
	assets: Array<UnusedAssetPreview>;
}

export function UnusedAssetsCleanup(props: Readonly<UnusedAssetsCleanupProps>): ReactNode {
	const { assets } = props;

	const t = useExtracted();
	const router = useRouter();

	const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set());
	const visibleAssets = assets.filter((asset) => !removedIds.has(asset.id));
	const visibleTotalSize = visibleAssets.reduce((sum, asset) => sum + (asset.size ?? 0), 0);

	const [selected, setSelected] = useState<Selection>(() => new Set());
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isRefreshing, startRefreshTransition] = useTransition();
	const [result, setResult] = useState<DeleteUnusedAssetsResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Selection persists across pages, so normalise to an explicit set of ids we can measure and
	// delete. The `"all"` sentinel only arises from a keyboard select-all over the current page.
	const selectedIds =
		selected === "all" ? new Set(visibleAssets.map((asset) => asset.id)) : selected;

	const selectedSize = visibleAssets.reduce(
		(sum, asset) => (selectedIds.has(asset.id) ? sum + (asset.size ?? 0) : sum),
		0,
	);

	const allSelected = visibleAssets.length > 0 && selectedIds.size === visibleAssets.length;

	const { page, pageItems, perPage, setPage, totalItems, totalPages } =
		useClientPagination(visibleAssets);

	function toggleAll(isSelected: boolean) {
		setSelected(isSelected ? new Set(visibleAssets.map((asset) => asset.id)) : new Set());
	}

	async function deleteSelectedAssets(ids: Array<string>) {
		try {
			const deleteResult = await deleteUnusedAssetsAction(ids);
			const deletedIds = ids.filter(
				(id) => !deleteResult.skippedIds.includes(id) && !deleteResult.failedIds.includes(id),
			);
			setRemovedIds((current) => new Set([...current, ...deletedIds]));
			setResult(deleteResult);
			setSelected(new Set());
			setIsConfirmOpen(false);
			startRefreshTransition(() => {
				router.refresh();
			});
		} catch {
			setError(t("Could not delete the selected assets. Please try again."));
		} finally {
			setIsDeleting(false);
		}
	}

	function confirmDelete() {
		const ids = Array.from(selectedIds, String);
		setError(null);
		setIsDeleting(true);

		void deleteSelectedAssets(ids);
	}

	if (visibleAssets.length === 0) {
		return (
			<div className="my-8 text-sm text-balance text-muted-fg">
				{result != null && result.deletedCount > 0
					? t("Deleted {count} unused assets, reclaiming {size}.", {
							count: String(result.deletedCount),
							size: formatFileSize(result.reclaimedSize),
						})
					: t("No unused assets found.")}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-y-(--layout-padding)">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Checkbox isSelected={allSelected} onChange={toggleAll}>
					{t("{count} unused assets · {size} reclaimable", {
						count: String(visibleAssets.length),
						size: formatFileSize(visibleTotalSize),
					})}
				</Checkbox>

				<Button
					intent="danger"
					isDisabled={selectedIds.size === 0 || isDeleting || isRefreshing}
					isPending={isRefreshing}
					onPress={() => {
						setIsConfirmOpen(true);
					}}
				>
					{isRefreshing ? (
						<Fragment>
							<ProgressCircle aria-label={t("Updating...")} isIndeterminate={true} />
							<span aria-hidden={true}>{t("Updating...")}</span>
						</Fragment>
					) : selectedIds.size > 0 ? (
						t("Delete selected ({count}) · {size}", {
							count: String(selectedIds.size),
							size: formatFileSize(selectedSize),
						})
					) : (
						t("Delete selected")
					)}
				</Button>
			</div>

			{result != null && (result.skippedIds.length > 0 || result.failedIds.length > 0) ? (
				<p
					className="flex items-center gap-x-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-subtle-fg"
					role="alert"
				>
					<AlertTriangleIcon aria-hidden={true} className="shrink-0 block-4 inline-4" />
					{t(
						"{skipped} assets were skipped (no longer unused) and {failed} could not be removed from storage.",
						{
							skipped: String(result.skippedIds.length),
							failed: String(result.failedIds.length),
						},
					)}
				</p>
			) : null}

			<GridList
				aria-label={t("Unused assets")}
				className="grid grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))] gap-(--layout-padding)"
				items={pageItems}
				layout="grid"
				onSelectionChange={setSelected}
				selectedKeys={selected}
				selectionBehavior="toggle"
				selectionMode="multiple"
			>
				{(asset) => (
					<GridListItem
						className={(values) =>
							cn(
								"items-stretch gap-3 p-2.5 [--grid-list-item-text-active:var(--color-fg)]",
								values.isSelected && "bg-danger/8 inset-ring-danger/60",
							)
						}
						id={asset.id}
						textValue={asset.label}
					>
						<div className="relative shrink-0 self-start block-32 inline-32">
							<AssetPreview
								alt={asset.label}
								className="overflow-hidden rounded-sm bg-muted block-32 inline-32"
								imageClassName="object-contain"
								kindLabelClassName="bg-bg/90"
								mimeType={asset.mimeType}
								src={asset.url}
								storageKey={asset.key}
							/>
							{asset.mimeType?.startsWith("image/") ? (
								<Modal>
									<Button
										aria-label={t("View full-size image")}
										className="absolute inset-e-1 inset-bs-1 bg-bg/80 backdrop-blur-sm"
										intent="outline"
										size="sq-xs"
									>
										<ExpandIcon aria-hidden={true} className="block-3.5 inline-3.5" />
									</Button>
									<ModalContent aria-label={asset.label} size="5xl">
										<div className="flex items-center justify-center p-4">
											<img
												alt={asset.label}
												className="object-contain max-block-[80vh] max-inline-full"
												src={`/api/assets/${asset.id}/download`}
											/>
										</div>
									</ModalContent>
								</Modal>
							) : null}
						</div>
						<div className="flex flex-1 flex-col gap-y-1 min-inline-0">
							<span className="line-clamp-2 text-sm/tight font-medium wrap-break-word">
								{asset.label}
							</span>
							<div className="mbs-auto flex flex-col gap-y-0.5 pbs-1 text-xs text-muted-fg">
								<span>{asset.size != null ? formatFileSize(asset.size) : t("unknown size")}</span>
								<span className="truncate" title={asset.mimeType}>
									{asset.mimeType}
								</span>
								<a
									className="mbs-0.5 inline-flex items-center gap-x-1 underline inline-fit hover:text-fg"
									download={true}
									href={`/api/assets/${asset.id}/download`}
								>
									<DownloadIcon aria-hidden={true} className="block-3.5 inline-3.5" />
									{t("Download")}
								</a>
							</div>
						</div>
					</GridListItem>
				)}
			</GridList>

			{totalItems > perPage ? (
				<Paginate
					page={page}
					perPage={perPage}
					setPage={setPage}
					total={totalPages}
					totalItems={totalItems}
				/>
			) : null}

			<ModalContent
				isOpen={isConfirmOpen}
				onOpenChange={(open) => {
					if (!open && !isDeleting) {
						setIsConfirmOpen(false);
					}
				}}
			>
				<ModalHeader
					title={t("Delete {count} unused assets", { count: String(selectedIds.size) })}
					description={t(
						"This permanently removes {count} assets ({size}) from storage and the database. This action cannot be undone.",
						{ count: String(selectedIds.size), size: formatFileSize(selectedSize) },
					)}
				/>
				{error != null ? (
					<div className="px-6 pbe-2">
						<p
							className="flex items-center gap-x-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
							role="alert"
						>
							<AlertTriangleIcon aria-hidden={true} className="shrink-0 block-4 inline-4" />
							{error}
						</p>
					</div>
				) : null}
				<ModalFooter>
					<ModalClose isDisabled={isDeleting}>{t("Cancel")}</ModalClose>
					<Button intent="danger" isPending={isDeleting} onPress={confirmDelete}>
						{isDeleting ? (
							<Fragment>
								<ProgressCircle aria-label={t("Deleting...")} isIndeterminate={true} />
								<span aria-hidden={true}>{t("Deleting...")}</span>
							</Fragment>
						) : (
							t("Delete")
						)}
					</Button>
				</ModalFooter>
			</ModalContent>
		</div>
	);
}
