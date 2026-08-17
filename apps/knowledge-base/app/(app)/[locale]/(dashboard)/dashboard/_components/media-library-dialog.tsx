"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import type { AssetPrefix } from "@dariah-eric/storage/config";
import { Button } from "@dariah-eric/ui/button";
import { Label } from "@dariah-eric/ui/field";
import { GridList, GridListItem } from "@dariah-eric/ui/grid-list";
import { Input } from "@dariah-eric/ui/input";
import {
	ModalBody,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@dariah-eric/ui/modal";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { SearchField, SearchInput } from "@dariah-eric/ui/search-field";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { Tab, TabList, TabPanel, Tabs } from "@dariah-eric/ui/tabs";
import { TextField } from "@dariah-eric/ui/text-field";
import { ToggleGroup, ToggleGroupItem } from "@dariah-eric/ui/toggle-group";
import { ListBulletIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import cn from "clsx/lite";
import { useExtracted } from "next-intl";
import {
	type ComponentType,
	Fragment,
	type ReactNode,
	useEffect,
	useRef,
	useState,
	useTransition,
} from "react";
import { FileTrigger, type Selection } from "react-aria-components";

import { AssetPreview } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/asset-preview";
import type { MediaLibraryAsset } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-asset";
import { uploadImageAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/upload-image.action";
import { imageMimeTypes, imageSizeLimit, mediaLibraryPageSize } from "@/config/assets.config";
import { formatFileSize } from "@/lib/format-file-size";

interface MediaLibraryDialogProps<T extends AssetPrefix> {
	acceptedFileTypes?: ReadonlyArray<string>;
	initialAssets: Array<MediaLibraryAsset>;
	onSelect: (key: string, url: string) => void;
	defaultPrefix: T;
	prefixes: ReadonlyArray<T>;
	trigger?: ComponentType<{ open: () => void }>;
}

type ActiveTab = "select" | "upload";

type AssetsLayout = "grid" | "list";

interface LicenseOption {
	id: string;
	code: string;
	name: string;
}

export function MediaLibraryDialog<T extends AssetPrefix>(
	props: Readonly<MediaLibraryDialogProps<T>>,
): ReactNode {
	const {
		acceptedFileTypes = imageMimeTypes,
		initialAssets,
		defaultPrefix,
		onSelect,
		prefixes,
		trigger,
	} = props;

	const t = useExtracted();

	const [isOpen, setIsOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<ActiveTab>("select");

	// Select tab state
	const [selectedKeys, setSelectedKeys] = useState<Selection>(() => new Set());
	const [selectedAsset, setSelectedAsset] = useState<MediaLibraryAsset | null>(null);
	const [displayedAssets, setDisplayedAssets] = useState<Array<MediaLibraryAsset>>(initialAssets);
	const [selectedPrefix, setSelectedPrefix] = useState<T>(defaultPrefix);
	const [offset, setOffset] = useState<number>(0);
	const [query, setQuery] = useState("");
	const [appliedQ, setAppliedQ] = useState("");
	const [layout, setLayout] = useState<AssetsLayout>("grid");
	const [isFetching, startFetching] = useTransition();

	// Upload tab state
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [licenseOptions, setLicenseOptions] = useState<Array<LicenseOption>>([]);
	const [isUploading, startUploading] = useTransition();

	const uploadFormRef = useRef<HTMLFormElement>(null);

	const hasPrev = offset > 0;
	const hasNext = displayedAssets.length === mediaLibraryPageSize;

	async function fetchPage(
		newOffset: number,
		q: string,
		fetchPrefix: T,
	): Promise<Array<MediaLibraryAsset>> {
		const params = new URLSearchParams({ prefix: fetchPrefix });
		if (q) {
			params.set("q", q);
		}
		if (newOffset > 0) {
			params.set("offset", String(newOffset));
		}
		const response = await fetch(`/api/assets?${params.toString()}`);
		const data = (await response.json()) as { items: Array<MediaLibraryAsset> };
		return data.items;
	}

	async function fetchLicenseOptions(): Promise<Array<LicenseOption>> {
		const response = await fetch("/api/licenses");
		const data = (await response.json()) as { items: Array<LicenseOption> };

		return data.items;
	}

	function resetUploadTab() {
		if (pendingFileUrl != null) {
			URL.revokeObjectURL(pendingFileUrl);
		}
		setPendingFile(null);
		setPendingFileUrl(null);
		setUploadError(null);
		uploadFormRef.current?.reset();
	}

	function handleOpen() {
		setIsOpen(true);
		setActiveTab("select");
		setSelectedPrefix(defaultPrefix);
		setOffset(0);
		setQuery("");
		setAppliedQ("");
		setSelectedKeys(new Set());
		setSelectedAsset(null);
		startFetching(async () => {
			const [items, licenses] = await Promise.all([
				fetchPage(0, "", defaultPrefix),
				fetchLicenseOptions(),
			]);
			setDisplayedAssets(items);
			setLicenseOptions(licenses);
		});
	}

	function handleOpenChange(open: boolean) {
		setIsOpen(open);
		if (!open) {
			resetUploadTab();
		}
	}

	function handlePrefixChange(newPrefix: T) {
		setSelectedPrefix(newPrefix);
		setOffset(0);
		setQuery("");
		setAppliedQ("");
		setSelectedKeys(new Set());
		setSelectedAsset(null);
		startFetching(async () => {
			const items = await fetchPage(0, "", newPrefix);
			setDisplayedAssets(items);
		});
	}

	function handleSelectionChange(keys: Selection) {
		setSelectedKeys(keys);
		if (keys !== "all" && keys.size > 0) {
			const key = [...keys][0] as string;
			const asset = displayedAssets.find((a) => a.key === key);
			if (asset) {
				setSelectedAsset(asset);
			}
		} else {
			setSelectedAsset(null);
		}
	}

	// Debounced search-as-you-type: fetch the first page whenever the trimmed
	// query settles to a value different from what is currently applied.
	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handle = window.setTimeout(() => {
			const q = query.trim();
			if (q === appliedQ) {
				return;
			}
			setAppliedQ(q);
			setSelectedKeys(new Set());
			setSelectedAsset(null);
			startFetching(async () => {
				const items = await fetchPage(0, q, selectedPrefix);
				setDisplayedAssets(items);
				setOffset(0);
			});
		}, 300);

		return () => {
			window.clearTimeout(handle);
		};
	}, [query, appliedQ, selectedPrefix, isOpen]);

	function handlePrev() {
		const newOffset: number = offset - mediaLibraryPageSize;
		setSelectedKeys(new Set());
		setSelectedAsset(null);
		startFetching(async () => {
			const items = await fetchPage(newOffset, appliedQ, selectedPrefix);
			setDisplayedAssets(items);
			setOffset(newOffset);
		});
	}

	function handleNext() {
		const newOffset: number = offset + mediaLibraryPageSize;
		setSelectedKeys(new Set());
		setSelectedAsset(null);
		startFetching(async () => {
			const items = await fetchPage(newOffset, appliedQ, selectedPrefix);
			setDisplayedAssets(items);
			setOffset(newOffset);
		});
	}

	function handleFileChoose(files: FileList | null) {
		const file = files?.[0] ?? null;
		if (pendingFileUrl != null) {
			URL.revokeObjectURL(pendingFileUrl);
		}

		if (file != null && file.size > imageSizeLimit) {
			setPendingFile(null);
			setPendingFileUrl(null);
			setUploadError(
				t("The selected image is too large. Choose an image smaller than {size}.", {
					size: formatFileSize(imageSizeLimit),
				}),
			);
			return;
		}

		setPendingFile(file);
		setPendingFileUrl(file != null ? URL.createObjectURL(file) : null);
		setUploadError(null);
	}

	function handleUploadAction(formData: FormData) {
		if (pendingFile == null || pendingFile.size > imageSizeLimit) {
			return;
		}
		formData.append("file", pendingFile);
		startUploading(async () => {
			const result = await uploadImageAction(createActionStateInitial(), formData);

			if (result.status === "success") {
				onSelect(result.data.key, result.data.url);
				resetUploadTab();
				setIsOpen(false);
			}
		});
	}

	function handleConfirm() {
		if (selectedAsset == null) {
			return;
		}
		onSelect(selectedAsset.key, selectedAsset.url);
		resetUploadTab();
		setIsOpen(false);
	}

	const isPending = isUploading || isFetching;
	const Trigger = trigger;

	return (
		<Fragment>
			{Trigger != null ? (
				<Trigger open={handleOpen} />
			) : (
				<Button intent="outline" onPress={handleOpen}>
					{t("Select image")}
				</Button>
			)}

			<ModalContent isOpen={isOpen} onOpenChange={handleOpenChange} size="3xl">
				<ModalHeader
					description={t("Select an existing image or upload a new one.")}
					title={t("Media library")}
				/>

				<ModalBody className="flex block-128 flex-col">
					<Tabs
						className="flex flex-1 flex-col min-block-0"
						onSelectionChange={(key) => {
							setActiveTab(key as ActiveTab);
						}}
						selectedKey={activeTab}
					>
						<TabList aria-label={t("Media library")}>
							<Tab id="select">{t("Select")}</Tab>
							<Tab id="upload">{t("Upload")}</Tab>
						</TabList>

						<TabPanel
							className="flex flex-1 flex-col gap-3 min-block-0"
							id="select"
							shouldPreserveState={true}
						>
							<div className="flex items-center gap-2">
								{prefixes.map((p) => (
									<Button
										key={p}
										intent={selectedPrefix === p ? "primary" : "outline"}
										isDisabled={isPending}
										onPress={() => {
											handlePrefixChange(p);
										}}
									>
										{p}
									</Button>
								))}

								<ToggleGroup
									aria-label={t("Layout")}
									className="ms-auto shrink-0"
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
							</div>

							<SearchField aria-label={t("Search")} onChange={setQuery} value={query}>
								<SearchInput placeholder={t("Search...")} />
							</SearchField>

							{displayedAssets.length === 0 && !isPending ? (
								<div className="flex flex-1 items-center justify-center">
									<p className="text-center text-muted-fg text-sm">
										{appliedQ
											? t("No assets found for your search.")
											: t("No assets found. Upload one to get started.")}
									</p>
								</div>
							) : (
								<div className="relative flex-1 overflow-y-auto">
									{layout === "grid" ? (
										<GridList
											aria-label={t("Media library")}
											className={cn(
												"grid grid-cols-[repeat(auto-fill,minmax(min(8rem,100%),1fr))] gap-3",
												isPending && "opacity-50",
											)}
											items={displayedAssets}
											layout="grid"
											onSelectionChange={handleSelectionChange}
											selectedKeys={selectedKeys}
											selectionBehavior="replace"
											selectionMode="single"
										>
											{(asset) => (
												<GridListItem
													className="flex flex-col gap-1 p-1 place-content-center"
													id={asset.key}
													textValue={asset.label}
												>
													<AssetPreview
														alt={asset.label}
														className="block-24 inline-24"
														imageClassName="rounded-sm object-cover"
														kindLabelClassName="bg-background/90"
														mimeType={asset.mimeType}
														src={asset.url}
														storageKey={asset.key}
													/>
													<span className="inline-24 truncate text-center text-xs text-muted-fg">
														{asset.label}
													</span>
												</GridListItem>
											)}
										</GridList>
									) : (
										<GridList
											aria-label={t("Media library")}
											className={cn("flex flex-col gap-1.5", isPending && "opacity-50")}
											items={displayedAssets}
											onSelectionChange={handleSelectionChange}
											selectedKeys={selectedKeys}
											selectionBehavior="replace"
											selectionMode="single"
										>
											{(asset) => (
												<GridListItem
													className="flex flex-row items-center gap-3 p-1.5"
													id={asset.key}
													textValue={asset.label}
												>
													<AssetPreview
														alt={asset.label}
														className="block-12 inline-16 shrink-0"
														imageClassName="rounded-sm object-contain"
														kindLabelClassName="bg-background/90 text-xs"
														mimeType={asset.mimeType}
														src={asset.url}
														storageKey={asset.key}
													/>
													<div className="flex min-inline-0 flex-1 flex-col gap-y-0.5">
														<span className="truncate text-sm/tight font-medium">
															{asset.label}
														</span>
														{asset.mimeType != null ? (
															<span className="text-xs text-muted-fg">{asset.mimeType}</span>
														) : null}
													</div>
												</GridListItem>
											)}
										</GridList>
									)}

									{isPending ? (
										<div className="absolute inset-0 flex items-center justify-center">
											<ProgressCircle isIndeterminate={true} />
										</div>
									) : null}
								</div>
							)}

							<div className="flex items-center justify-between">
								<Button intent="outline" isDisabled={!hasPrev || isPending} onPress={handlePrev}>
									{t("Previous")}
								</Button>
								<Button intent="outline" isDisabled={!hasNext || isPending} onPress={handleNext}>
									{t("Next")}
								</Button>
							</div>
						</TabPanel>

						<TabPanel
							className="flex flex-1 flex-col gap-4 overflow-y-auto p-1"
							id="upload"
							shouldPreserveState={true}
						>
							<form ref={uploadFormRef} action={handleUploadAction} id="upload-form">
								<input name="prefix" type="hidden" value={selectedPrefix} />

								<div className="flex flex-col gap-4">
									<div className="flex flex-wrap items-start gap-4">
										<FileTrigger acceptedFileTypes={acceptedFileTypes} onSelect={handleFileChoose}>
											<Button intent="outline" type="button">
												{t("Choose file...")}
											</Button>
										</FileTrigger>

										{pendingFileUrl != null ? (
											<img
												alt={t("Preview")}
												className="block-24 inline-auto max-inline-full rounded-sm"
												src={pendingFileUrl}
											/>
										) : null}
									</div>

									{pendingFile != null ? (
										<p className="text-muted-fg text-sm">{pendingFile.name}</p>
									) : null}

									{uploadError != null ? (
										<p className="text-danger text-sm" role="alert">
											{uploadError}
										</p>
									) : null}

									<TextField name="label">
										<Label>{t("Label")}</Label>
										<Input placeholder={pendingFile?.name ?? ""} />
									</TextField>

									<TextField name="alt">
										<Label>{t("Alt text")}</Label>
										<Input />
									</TextField>

									<TextField name="caption">
										<Label>{t("Caption")}</Label>
										<Input />
									</TextField>

									<Select defaultValue="none" name="licenseId">
										<Label>{t("License")}</Label>
										<SelectTrigger />
										<SelectContent>
											<SelectItem id="none">{t("No license")}</SelectItem>
											{licenseOptions.map((license) => (
												<SelectItem key={license.id} id={license.id}>
													{license.code} - {license.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</form>
						</TabPanel>
					</Tabs>
				</ModalBody>

				<ModalFooter>
					<ModalClose>{t("Cancel")}</ModalClose>

					{activeTab === "select" ? (
						<Button isDisabled={selectedAsset == null} onPress={handleConfirm}>
							{t("Select")}
						</Button>
					) : (
						<Button
							form="upload-form"
							isDisabled={pendingFile == null || uploadError != null}
							isPending={isUploading}
							type="submit"
						>
							{isUploading ? (
								<Fragment>
									<ProgressCircle isIndeterminate={true} />
									{t("Uploading...")}
								</Fragment>
							) : (
								t("Upload")
							)}
						</Button>
					)}
				</ModalFooter>
			</ModalContent>
		</Fragment>
	);
}
