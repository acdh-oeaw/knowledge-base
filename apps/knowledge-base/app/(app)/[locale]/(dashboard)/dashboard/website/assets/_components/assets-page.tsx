"use client";

import { assetPrefixes } from "@dariah-eric/storage/config";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@dariah-eric/ui/toggle-group";
import { ListBulletIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useState } from "react";

import { AssetPreview } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/asset-preview";
import {
	EntityListHeader,
	EntityListPagination,
	EntityListSearchField,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { EditAssetMetadataDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_components/edit-asset-metadata-dialog";
import { UploadImageDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_components/upload-image-dialog";
import { dashboardPageSize } from "@/config/pagination.config";
import { formatFileSize } from "@/lib/format-file-size";
import { useRouter } from "@/lib/navigation/navigation";

interface AssetItem {
	id: string;
	key: string;
	label: string;
	alt: string | null;
	caption: string | null;
	licenseId: string | null;
	mimeType: string;
	size: number | null;
	url: string;
}

interface LicenseOption {
	id: string;
	code: string;
	name: string;
}

interface AssetsPageProps {
	assets: {
		items: Array<AssetItem>;
		total: number;
	};
	licenses: Array<LicenseOption>;
	page: number;
	prefix: string;
	q: string;
}

const pageSize = dashboardPageSize;

type AssetsLayout = "grid" | "list";

export function AssetsPage(props: Readonly<AssetsPageProps>): ReactNode {
	const { assets, licenses, page: initialPage, prefix: initialPrefix, q: initialQ } = props;

	const t = useExtracted();
	const router = useRouter();
	const search = useUrlPaginatedSearch({
		filters: { prefix: initialPrefix },
		page: initialPage,
		q: initialQ,
	});
	const selectedPrefix = search.filters.prefix !== "" ? search.filters.prefix : "all";
	const totalPages = Math.max(1, Math.ceil(assets.total / pageSize));
	const [layout, setLayout] = useState<AssetsLayout>("grid");
	const licensesById = new Map(licenses.map((license) => [license.id, license]));

	return (
		<Fragment>
			<EntityListHeader
				title={t("Assets")}
				description={t("Manage all images in the media library.")}
				action={
					<>
						<EntityListSearchField search={search} placeholder={t("Search by label")} />

						<Select
							aria-label={t("Filter by prefix")}
							onChange={(key) => {
								const value = String(key);
								search.setFilter("prefix", value === "all" ? "" : value);
							}}
							value={selectedPrefix}
						>
							<SelectTrigger />
							<SelectContent>
								<SelectItem id="all">{t("All prefixes")}</SelectItem>
								{assetPrefixes.map((prefix) => (
									<SelectItem key={prefix} id={prefix}>
										{prefix}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<ToggleGroup
							aria-label={t("Layout")}
							className="shrink-0"
							disallowEmptySelection={true}
							onSelectionChange={(keys) => {
								const [selectedLayout] = [...keys] as Array<AssetsLayout>;
								setLayout(selectedLayout ?? "grid");
							}}
							selectedKeys={new Set([layout])}
							selectionMode="single"
							size="sq-sm"
						>
							<ToggleGroupItem id="grid" aria-label={t("Grid layout")}>
								<Squares2X2Icon aria-hidden={true} data-slot="icon" />
							</ToggleGroupItem>
							<ToggleGroupItem id="list" aria-label={t("List layout")}>
								<ListBulletIcon aria-hidden={true} data-slot="icon" />
							</ToggleGroupItem>
						</ToggleGroup>

						<UploadImageDialog
							licenses={licenses}
							onSuccess={() => {
								router.refresh();
							}}
						/>
					</>
				}
			/>

			{assets.items.length === 0 ? (
				<div className="flex flex-1 items-center justify-center py-16">
					<p className="text-center text-muted-fg text-sm">
						{search.inputValue !== "" || selectedPrefix !== "all"
							? t("No images match your filters.")
							: t("No images found. Upload one to get started.")}
					</p>
				</div>
			) : layout === "grid" ? (
				<ul className="grid grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))] gap-4 content-start">
					{assets.items.map((asset) => {
						const prefix = asset.key.split("/")[0] ?? "";
						return (
							<li key={asset.id}>
								<figure className="flex flex-col gap-y-2">
									<div className="relative overflow-hidden rounded-lg bg-muted aspect-square">
										<AssetPreview
											alt={asset.alt ?? asset.label}
											className="block-full inline-full"
											imageClassName="object-cover"
											kindLabelClassName="bg-background/90 text-xs"
											mimeType={asset.mimeType}
											src={asset.url}
											storageKey={asset.key}
										/>
										<EditAssetMetadataDialog
											asset={asset}
											licenses={licenses}
											onSuccess={() => {
												router.refresh();
											}}
										/>
									</div>
									<figcaption className="flex flex-col gap-y-0.5 px-0.5">
										<span className="truncate text-sm/tight font-medium">{asset.label}</span>
										<span className="text-xs text-muted-fg">
											{prefix}
											{asset.size != null ? ` · ${formatFileSize(asset.size)}` : null}
										</span>
									</figcaption>
								</figure>
							</li>
						);
					})}
				</ul>
			) : (
				<ul className="flex flex-col gap-y-3 content-start">
					{assets.items.map((asset) => {
						const prefix = asset.key.split("/")[0] ?? "";
						const license = asset.licenseId != null ? licensesById.get(asset.licenseId) : undefined;
						return (
							<li key={asset.id}>
								<figure className="flex flex-row items-start gap-x-3 rounded-lg border border-border p-2.5">
									<div className="block-24 inline-32 shrink-0 overflow-hidden rounded-md bg-muted">
										<AssetPreview
											alt={asset.alt ?? asset.label}
											className="block-full inline-full"
											imageClassName="object-contain"
											kindLabelClassName="bg-background/90 text-xs"
											mimeType={asset.mimeType}
											src={asset.url}
											storageKey={asset.key}
										/>
									</div>
									<figcaption className="flex min-inline-0 flex-1 flex-col gap-y-1.5">
										<div className="flex flex-row items-baseline gap-x-2">
											<span className="truncate text-sm/tight font-medium">{asset.label}</span>
											<span className="shrink-0 text-xs text-muted-fg">{prefix}</span>
										</div>
										{asset.alt != null && asset.alt !== "" ? (
											<span className="line-clamp-1 text-xs text-muted-fg">
												<span className="font-medium">{t("Alt text")}:</span> {asset.alt}
											</span>
										) : null}
										{asset.caption != null && asset.caption !== "" ? (
											<span className="line-clamp-2 text-xs text-muted-fg">
												<span className="font-medium">{t("Caption")}:</span> {asset.caption}
											</span>
										) : null}
										<div className="flex flex-row flex-wrap items-center gap-x-1.5 text-xs text-muted-fg">
											{license != null ? (
												<Fragment>
													<span>{license.code}</span>
													<span aria-hidden={true}>{"·"}</span>
												</Fragment>
											) : null}
											<span>{asset.mimeType}</span>
											{asset.size != null ? (
												<Fragment>
													<span aria-hidden={true}>{"·"}</span>
													<span>{formatFileSize(asset.size)}</span>
												</Fragment>
											) : null}
										</div>
									</figcaption>
									<EditAssetMetadataDialog
										asset={asset}
										licenses={licenses}
										onSuccess={() => {
											router.refresh();
										}}
										triggerClassName="shrink-0"
									/>
								</figure>
							</li>
						);
					})}
				</ul>
			)}

			{totalPages > 1 ? (
				<EntityListPagination search={search} total={assets.total} pageSize={pageSize} />
			) : null}
		</Fragment>
	);
}
