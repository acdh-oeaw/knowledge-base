"use client";

import { isNonEmptyString } from "@acdh-oeaw/lib";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import type { AssetPrefix } from "@dariah-eric/storage/config";
import { Button, buttonStyles } from "@dariah-eric/ui/button";
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
import { toPlainText } from "@dariah-eric/ui/rich-text";
import { SearchField, SearchInput } from "@dariah-eric/ui/search-field";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { Tab, TabList, TabPanel, Tabs } from "@dariah-eric/ui/tabs";
import { TextField } from "@dariah-eric/ui/text-field";
import { ToggleGroup, ToggleGroupItem } from "@dariah-eric/ui/toggle-group";
import { ArrowDownTrayIcon, ListBulletIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
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
import { CaptionField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/caption-field";
import type { MediaLibraryAsset } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-asset";
import {
	EditAssetMetadataDialog,
	type SavedAssetMetadata,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_components/edit-asset-metadata-dialog";
import { uploadImageAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/upload-image.action";
import { imageMimeTypes, imageSizeLimit, mediaLibraryPageSize } from "@/config/assets.config";
import { formatDimensions } from "@/lib/format-dimensions";
import { formatFileSize } from "@/lib/format-file-size";

interface MediaLibraryDialogProps<T extends AssetPrefix> {
	acceptedFileTypes?: ReadonlyArray<string>;
	initialAssets: Array<MediaLibraryAsset>;
	onSelect: (key: string, url: string, asset?: MediaLibraryAsset) => void;
	defaultPrefix: T;
	prefixes: ReadonlyArray<T>;
	/**
	 * Renders its own trigger when given one. Callers that open the dialog from a menu pass
	 * `isOpen`/`onOpenChange` instead: a trigger nested in a menu is unmounted by the menu closing,
	 * before the dialog it opens ever appears.
	 */
	trigger?: ComponentType<{ open: () => void }>;
	triggerLabel?: string;
	/**
	 * The asset the dialog opens on, when it was opened to replace one. Only honoured if the key is
	 * on the first page of the default prefix — see the open effect.
	 */
	selectedKey?: string | null;
	isOpen?: boolean;
	onOpenChange?: (isOpen: boolean) => void;
}

type ActiveTab = "select" | "upload";

type AssetsLayout = "grid" | "list";

function EditMetadataTrigger(props: Readonly<{ open: () => void }>): ReactNode {
	const { open } = props;
	const t = useExtracted();

	return (
		<Button intent="outline" onPress={open}>
			{t("Edit metadata")}
		</Button>
	);
}

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
		triggerLabel,
		selectedKey,
		isOpen: controlledIsOpen,
		onOpenChange,
	} = props;

	const t = useExtracted();
	const acceptsNonImageFiles = acceptedFileTypes.some((mimeType) => !mimeType.startsWith("image/"));

	const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
	const isOpen = controlledIsOpen ?? uncontrolledIsOpen;

	function setIsOpen(next: boolean) {
		setUncontrolledIsOpen(next);
		onOpenChange?.(next);
	}

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

	/**
	 * Everything the dialog needs on its way open: a freshly fetched first page rather than the
	 * `initialAssets` the last render happened to leave behind, and a selection that starts on
	 * `selectedKey` where the caller named one — opening on nothing would make "change this" look
	 * like "pick from scratch", and hide which asset is about to be replaced.
	 *
	 * The selection is applied once the page has arrived, because the asset behind the key is only
	 * known from the fetched rows. A key that is not on the first page (an older document, one the
	 * caller reached by searching) simply stays unselected; the author searches for its replacement
	 * as they would anyway.
	 *
	 * Driven by an effect rather than by the trigger's click handler, because a controlled caller
	 * opens the dialog by flipping `isOpen` and never goes through a trigger at all.
	 */
	useEffect(() => {
		if (!isOpen) {
			return;
		}

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

			const preselected =
				selectedKey != null ? items.find((item) => item.key === selectedKey) : undefined;
			if (preselected != null) {
				setSelectedKeys(new Set([preselected.key]));
				setSelectedAsset(preselected);
			}
		});
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- runs on the transition into open only.
	}, [isOpen]);

	function handleOpen() {
		setIsOpen(true);
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
				acceptsNonImageFiles
					? t("The selected file is too large. Choose a file smaller than {size}.", {
							size: formatFileSize(imageSizeLimit),
						})
					: t("The selected image is too large. Choose an image smaller than {size}.", {
							size: formatFileSize(imageSizeLimit),
						}),
			);
			return;
		}

		setPendingFile(file);
		setPendingFileUrl(file != null ? URL.createObjectURL(file) : null);
		setUploadError(null);
	}

	/** Labels a license id from the options this dialog already loaded, for the selection callback. */
	function resolveLicense(licenseId: string | null | undefined) {
		if (licenseId == null || licenseId === "" || licenseId === "none") {
			return null;
		}

		const license = licenseOptions.find((option) => option.id === licenseId);

		return license != null ? { code: license.code, name: license.name } : null;
	}

	function handleUploadAction(formData: FormData) {
		if (pendingFile == null || pendingFile.size > imageSizeLimit) {
			return;
		}
		formData.append("file", pendingFile);
		startUploading(async () => {
			const result = await uploadImageAction(createActionStateInitial(), formData);

			if (result.status === "success") {
				// The upload action returns no label; `uploadAsset` stores `label ?? file.name`, so the
				// label typed into the form - or the filename - is what was stored.
				const submittedLabel = formData.get("label");
				const label = isNonEmptyString(submittedLabel)
					? submittedLabel.trim() || pendingFile.name
					: pendingFile.name;
				onSelect(result.data.key, result.data.url, {
					...result.data,
					label,
					license: resolveLicense(result.data.licenseId),
				});
				resetUploadTab();
				setIsOpen(false);
			}
		});
	}

	function handleConfirm() {
		if (selectedAsset == null) {
			return;
		}
		onSelect(selectedAsset.key, selectedAsset.url, {
			...selectedAsset,
			license: resolveLicense(selectedAsset.licenseId),
		});
		resetUploadTab();
		setIsOpen(false);
	}

	function handleMetadataSaved(saved: SavedAssetMetadata) {
		if (selectedAsset == null) {
			return;
		}

		const updatedAsset = { ...selectedAsset, ...saved };
		setSelectedAsset(updatedAsset);
		setDisplayedAssets((assets) =>
			assets.map((asset) => (asset.key === updatedAsset.key ? updatedAsset : asset)),
		);
	}

	const isPending = isUploading || isFetching;
	const Trigger = trigger;
	const licensesById = new Map(licenseOptions.map((license) => [license.id, license]));

	return (
		<Fragment>
			{Trigger != null ? <Trigger open={handleOpen} /> : null}
			{/* A controlled caller opens the dialog from somewhere the dialog cannot live — a menu item —
			    so it wants no trigger of its own, not the default one. */}
			{Trigger == null && controlledIsOpen == null ? (
				<Button intent="outline" onPress={handleOpen}>
					{triggerLabel ?? t("Select image")}
				</Button>
			) : null}

			<ModalContent isOpen={isOpen} onOpenChange={handleOpenChange} size="3xl">
				<ModalHeader
					description={
						acceptsNonImageFiles
							? t("Select an existing file or upload a new one.")
							: t("Select an existing image or upload a new one.")
					}
					title={t("Media library")}
				/>

				<ModalBody className="flex flex-col block-128">
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
									<p className="text-center text-sm text-muted-fg">
										{appliedQ
											? t("No assets found for your search.")
											: t("No assets found. Upload one to get started.")}
									</p>
								</div>
							) : (
								<div className="relative flex-1 overflow-y-auto">
									{/*
									    Both layouts render a `GridList` in the same place, so React keeps one instance
									    across a switch — and a collection caches each row's markup against the item it
									    was built from, which does not change when only the layout does. Naming the
									    layout as a dependency invalidates that cache; without it the rows keep the
									    markup of the layout that built them until the next fetch replaces the items,
									    which is why paging or switching prefix "fixed" it. (In development the cache
									    is keyed by the render function's source too, so this only shows in a build.)
									    Anything else a row reads from outside its own asset belongs here for the same
									    reason — the licences a row names are fetched separately from the assets.
									*/}
									{layout === "grid" ? (
										<GridList
											aria-label={t("Media library")}
											className={cn(
												"grid grid-cols-[repeat(auto-fill,minmax(min(8rem,100%),1fr))] gap-3",
												isPending && "opacity-50",
											)}
											dependencies={[layout]}
											items={displayedAssets}
											layout="grid"
											onSelectionChange={handleSelectionChange}
											selectedKeys={selectedKeys}
											selectionBehavior="replace"
											selectionMode="single"
										>
											{(asset) => (
												<GridListItem
													className="flex flex-col place-content-center gap-1 p-1"
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
													<span className="truncate text-center text-xs text-muted-fg inline-24">
														{asset.label}
													</span>
												</GridListItem>
											)}
										</GridList>
									) : (
										<GridList
											aria-label={t("Media library")}
											className={cn("flex flex-col gap-2", isPending && "opacity-50")}
											dependencies={[layout, licenseOptions]}
											items={displayedAssets}
											onSelectionChange={handleSelectionChange}
											selectedKeys={selectedKeys}
											selectionBehavior="replace"
											selectionMode="single"
										>
											{(asset) => {
												const prefix = asset.key.split("/")[0] ?? "";
												const license =
													asset.licenseId != null ? licensesById.get(asset.licenseId) : undefined;
												const dimensions = formatDimensions(asset.width, asset.height);
												return (
													<GridListItem className="p-2.5" id={asset.key} textValue={asset.label}>
														{/* React Aria wraps a row's children in one grid cell, so the columns are
														    laid out inside that cell: flexing the row itself only arranges the
														    single cell and leaves thumbnail and metadata stacked. */}
														<div className="flex flex-row items-start gap-3 inline-full">
															<div className="shrink-0 overflow-hidden rounded-md bg-muted block-16 inline-24">
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
															<div className="flex flex-1 flex-col gap-y-1 min-inline-0">
																<div className="flex flex-row items-baseline gap-x-2">
																	<span className="truncate text-sm/tight font-medium">
																		{asset.label}
																	</span>
																	{prefix !== "" ? (
																		<span className="shrink-0 text-xs text-muted-fg">{prefix}</span>
																	) : null}
																</div>
																{asset.alt != null && asset.alt !== "" ? (
																	<span className="line-clamp-1 text-xs text-muted-fg">
																		<span className="font-medium">{t("Alt text")}:</span>{" "}
																		{asset.alt}
																	</span>
																) : null}
																{asset.caption != null && toPlainText(asset.caption) !== "" ? (
																	<span className="line-clamp-2 text-xs text-muted-fg">
																		<span className="font-medium">{t("Caption")}:</span>{" "}
																		{toPlainText(asset.caption)}
																	</span>
																) : null}
																<div className="flex flex-row flex-wrap items-center gap-x-1.5 text-xs text-muted-fg">
																	{license != null ? (
																		<Fragment>
																			<span>{license.code}</span>
																			<span aria-hidden={true}>{"·"}</span>
																		</Fragment>
																	) : null}
																	{asset.mimeType != null ? <span>{asset.mimeType}</span> : null}
																	{dimensions != null ? (
																		<Fragment>
																			<span aria-hidden={true}>{"·"}</span>
																			<span>{dimensions}</span>
																		</Fragment>
																	) : null}
																	{asset.size != null ? (
																		<Fragment>
																			<span aria-hidden={true}>{"·"}</span>
																			<span>{formatFileSize(asset.size)}</span>
																		</Fragment>
																	) : null}
																</div>
															</div>
														</div>
													</GridListItem>
												);
											}}
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

										{pendingFileUrl != null && pendingFile != null ? (
											<AssetPreview
												alt={pendingFile.name}
												className="rounded-sm block-24 inline-24"
												imageClassName="object-contain"
												mimeType={pendingFile.type}
												src={pendingFileUrl}
												storageKey={pendingFile.name}
											/>
										) : null}
									</div>

									{pendingFile != null ? (
										<p className="text-sm text-muted-fg">{pendingFile.name}</p>
									) : null}

									{uploadError != null ? (
										<p className="text-sm text-danger" role="alert">
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

									<CaptionField name="caption" />

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
						<Fragment>
							{selectedAsset != null ? (
								<a
									className={buttonStyles({ intent: "outline" })}
									download={true}
									href={`/api/assets/download?key=${encodeURIComponent(selectedAsset.key)}`}
								>
									<ArrowDownTrayIcon aria-hidden={true} className="block-4 inline-4" />
									{t("Download original")}
								</a>
							) : null}

							{selectedAsset?.id != null ? (
								<EditAssetMetadataDialog
									asset={{
										id: selectedAsset.id,
										key: selectedAsset.key,
										label: selectedAsset.label,
										alt: selectedAsset.alt ?? null,
										caption: selectedAsset.caption ?? null,
										licenseId: selectedAsset.licenseId ?? null,
										mimeType: selectedAsset.mimeType ?? "",
										width: selectedAsset.width,
										height: selectedAsset.height,
										url: selectedAsset.url,
									}}
									licenses={licenseOptions}
									onSuccess={handleMetadataSaved}
									trigger={EditMetadataTrigger}
								/>
							) : null}

							<Button isDisabled={selectedAsset == null} onPress={handleConfirm}>
								{t("Select")}
							</Button>
						</Fragment>
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
