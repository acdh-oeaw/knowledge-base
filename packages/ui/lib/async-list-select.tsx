"use client";

import { XMarkIcon } from "@heroicons/react/16/solid";
import { PlusIcon } from "@heroicons/react/20/solid";
import { useExtracted } from "next-intl";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
	Button as AriaButton,
	DialogTrigger as AriaDialogTrigger,
	Popover as AriaPopover,
	type Key,
	useDragAndDrop,
} from "react-aria-components";

import { Button } from "@/lib/button";
import { Label, fieldErrorStyles, fieldStyles } from "@/lib/field";
import {
	GridList,
	GridListDescription,
	GridListItem,
	GridListLabel,
	GridListStart,
} from "@/lib/grid-list";
import { ListBox, ListBoxDescription, ListBoxItem, ListBoxLabel } from "@/lib/list-box";
import { cx } from "@/lib/primitive";
import { ProgressCircle } from "@/lib/progress-circle";
import { SearchField, SearchInput } from "@/lib/search-field";
import {
	type AsyncOption,
	type AsyncOptionsFetchPage,
	useAsyncOptions,
} from "@/lib/use-async-options";

const defaultPageSize = 20;
const emptySelectedItems: Array<never> = [];

export interface AsyncListSelectProps<T extends AsyncOption> {
	"aria-label": string;
	/** Label for the "add" button that opens the options popover. */
	addLabel?: string;
	cacheKey?: string | number;
	/** Empty state shown in the options popover when a search yields nothing. */
	emptyMessage?: string;
	/** Message shown in place of the list when nothing is selected yet. */
	emptySelectionMessage?: string;
	errorMessage?: string;
	fetchPage: AsyncOptionsFetchPage<T>;
	initialItems: Array<T>;
	initialTotal: number;
	inputPlaceholder?: string;
	isDisabled?: boolean;
	/** When true, selected rows can be reordered by drag-and-drop and `onChange` preserves order. */
	isOrderable?: boolean;
	label?: string;
	/** Cap on the number of selected items. Further options are disabled once reached. */
	maxItems?: number;
	onChange: (ids: Array<string>) => void;
	pageSize?: number;
	/** Renders an option row inside the popover. Defaults to name + description. */
	renderItem?: (item: T) => ReactNode;
	/** Renders a selected row in the list. Defaults to name + description. */
	renderSelectedItem?: (item: AsyncOption) => ReactNode;
	selectedItems?: Array<T>;
	value: Array<string>;
}

function renderDefaultOption(item: AsyncOption): ReactNode {
	if (item.description == null || item.description === "") {
		return <ListBoxLabel className="truncate">{item.name}</ListBoxLabel>;
	}

	return (
		<>
			<ListBoxLabel className="truncate">{item.name}</ListBoxLabel>
			<ListBoxDescription className="truncate">{item.description}</ListBoxDescription>
		</>
	);
}

export function AsyncListSelect<T extends AsyncOption>(
	props: Readonly<AsyncListSelectProps<T>>,
): ReactNode {
	const { cacheKey, ...rest } = props;

	return <AsyncListSelectInner key={String(cacheKey ?? "default")} {...rest} />;
}

interface AsyncListSelectInnerProps<T extends AsyncOption> extends Omit<
	AsyncListSelectProps<T>,
	"cacheKey"
> {}

function AsyncListSelectInner<T extends AsyncOption>(
	props: Readonly<AsyncListSelectInnerProps<T>>,
): ReactNode {
	const {
		"aria-label": ariaLabel,
		addLabel,
		emptyMessage,
		emptySelectionMessage,
		errorMessage,
		fetchPage,
		initialItems,
		initialTotal,
		inputPlaceholder,
		isDisabled = false,
		isOrderable = false,
		label,
		maxItems,
		onChange,
		pageSize = defaultPageSize,
		renderItem,
		renderSelectedItem,
		selectedItems = emptySelectedItems,
		value,
	} = props;

	const t = useExtracted("ui");

	const [isOpen, setIsOpen] = useState(false);
	const [localSelectedItems, setLocalSelectedItems] = useState<Array<T>>(emptySelectedItems);

	const {
		displayedItems,
		handleNext,
		handlePrev,
		handleSearch,
		hasNext,
		hasPrev,
		isPending,
		loadError,
		searchText,
		setSearchText,
	} = useAsyncOptions({ fetchPage, initialItems, initialTotal, pageSize });

	const selectedItemMap = useMemo(() => {
		const map = new Map<string, AsyncOption>();

		for (const item of selectedItems) {
			map.set(item.id, item);
		}
		for (const item of localSelectedItems) {
			map.set(item.id, item);
		}
		for (const item of initialItems) {
			if (value.includes(item.id)) {
				map.set(item.id, item);
			}
		}
		for (const item of displayedItems) {
			if (value.includes(item.id)) {
				map.set(item.id, item);
			}
		}

		return map;
	}, [displayedItems, initialItems, localSelectedItems, selectedItems, value]);

	const resolvedSelectedItems = useMemo(
		() => value.map((id) => selectedItemMap.get(id) ?? { id, name: id }),
		[selectedItemMap, value],
	);

	// Read `value` through a ref so the remove handler is never stale. React Aria's GridList caches
	// each row's rendered content by item reference and does not re-invoke the render function while
	// references stay stable, which would otherwise freeze an outdated `value` into this closure and
	// resurrect previously-removed ids on the next removal.
	const valueRef = useRef(value);
	valueRef.current = value;

	const remove = useCallback(
		(id: string) => {
			onChange(valueRef.current.filter((selectedId) => selectedId !== id));
		},
		[onChange],
	);

	const { dragAndDropHooks } = useDragAndDrop({
		getItems: (keys) =>
			[...keys].map((key) => {
				return { "text/plain": String(key) };
			}),
		onReorder(event) {
			const moving = value.filter((id) => event.keys.has(id as Key));
			const remaining = value.filter((id) => !event.keys.has(id as Key));
			const targetIndex = remaining.indexOf(String(event.target.key));
			const insertAt = event.target.dropPosition === "before" ? targetIndex : targetIndex + 1;

			onChange([...remaining.slice(0, insertAt), ...moving, ...remaining.slice(insertAt)]);
		},
	});

	const isAtMax = maxItems != null && value.length >= maxItems;
	const disabledOptionKeys = isAtMax
		? displayedItems.filter((item) => !value.includes(item.id)).map((item) => item.id)
		: undefined;

	const renderOption = renderItem ?? renderDefaultOption;
	const loadErrorMessage =
		loadError != null && loadError.message !== ""
			? loadError.message
			: t("Could not load options.");

	return (
		<div className={fieldStyles({ className: "group/select space-y-2" })} data-slot="control">
			{label != null ? <Label>{label}</Label> : null}

			{resolvedSelectedItems.length > 0 ? (
				<GridList
					aria-label={ariaLabel}
					className="inline-full min-inline-56"
					// The caching the `remove` handler works around above (see `valueRef`) governs
					// everything a row renders, not just its handlers: `resolvedSelectedItems` holds the
					// same objects until the selection changes, so without naming them here a row would
					// keep the remove button of a field that has since been disabled, or the markup of a
					// superseded `renderSelectedItem`.
					dependencies={[isDisabled, renderSelectedItem]}
					dragAndDropHooks={isOrderable && !isDisabled ? dragAndDropHooks : undefined}
					items={resolvedSelectedItems}
				>
					{(item) => {
						const content =
							renderSelectedItem != null ? (
								renderSelectedItem(item)
							) : item.description != null && item.description !== "" ? (
								<>
									<GridListLabel className="truncate">{item.name}</GridListLabel>
									<GridListDescription className="truncate">{item.description}</GridListDescription>
								</>
							) : (
								<GridListLabel className="truncate">{item.name}</GridListLabel>
							);

						return (
							<GridListItem className="inline-full" id={item.id} textValue={item.name}>
								<GridListStart className="flex-1 min-inline-0">
									<div className="flex flex-col min-inline-0">{content}</div>
								</GridListStart>
								{!isDisabled ? (
									<AriaButton
										aria-label={t("Remove")}
										className="grid shrink-0 cursor-default place-content-center rounded-md text-muted-fg block-7 inline-7 hover:bg-muted hover:text-fg"
										onPress={() => {
											remove(item.id);
										}}
									>
										<XMarkIcon className="block-4 inline-4" />
									</AriaButton>
								) : null}
							</GridListItem>
						);
					}}
				</GridList>
			) : (
				<p className="text-sm text-muted-fg">{emptySelectionMessage ?? t("No selected items")}</p>
			)}

			<AriaDialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
				<Button className="self-start" intent="outline" isDisabled={isDisabled}>
					<PlusIcon />
					{addLabel ?? t("Add")}
				</Button>

				<AriaPopover
					className={cx(
						"group/popover flex origin-(--trigger-anchor-point) flex-col overflow-hidden rounded-xl border border-fg/10 bg-overlay text-overlay-fg shadow-xs outline-hidden max-inline-120 min-inline-72",
						"entering:animate-in entering:fade-in",
						"exiting:animate-out exiting:fade-out",
					)}
					placement="bottom start"
				>
					<div
						className="flex flex-1 flex-col gap-3 p-3 min-block-0"
						// Close on Escape. Captured before the search field (clears its value) and the list box
						// (clears selection) can consume the key, so Escape reliably dismisses the popover.
						onKeyDownCapture={(event) => {
							if (event.key === "Escape") {
								event.stopPropagation();
								setIsOpen(false);
							}
						}}
					>
						<SearchField onChange={setSearchText} onSubmit={handleSearch} value={searchText}>
							<SearchInput autoFocus={true} placeholder={inputPlaceholder ?? t("Search")} />
						</SearchField>

						{loadError != null ? (
							<p className="py-3 text-center text-sm text-danger-subtle-fg">{loadErrorMessage}</p>
						) : displayedItems.length > 0 ? (
							<div className="relative flex flex-1 min-block-0">
								<ListBox
									aria-label={ariaLabel}
									className={cx(
										"flex-1 inline-full max-block-none min-block-0 [&::-webkit-scrollbar]:block-2! [&::-webkit-scrollbar]:inline-2!",
										isPending ? "opacity-50" : undefined,
									)}
									// Options survive between fetches as the same objects, so a caller that swaps its
									// `renderItem` would otherwise keep the markup the previous one produced.
									dependencies={[renderOption]}
									disabledKeys={disabledOptionKeys}
									items={displayedItems}
									onSelectionChange={(keys) => {
										if (keys === "all") {
											return;
										}

										const nextSelectedKeys = new Set([...keys].map(String));

										setLocalSelectedItems((previousItems) => {
											const map = new Map(previousItems.map((item) => [item.id, item] as const));
											for (const item of displayedItems) {
												if (nextSelectedKeys.has(item.id)) {
													map.set(item.id, item);
												}
											}
											return [...map.values()];
										});

										// Preserve existing order; append newly selected ids at the end.
										const kept = value.filter((id) => nextSelectedKeys.has(id));
										const added = [...nextSelectedKeys].filter((id) => !value.includes(id));
										onChange([...kept, ...added]);
									}}
									selectedKeys={new Set(value)}
									selectionBehavior="toggle"
									selectionMode="multiple"
								>
									{(item) => (
										<ListBoxItem id={item.id} textValue={item.name}>
											{renderOption(item)}
										</ListBoxItem>
									)}
								</ListBox>

								{isPending ? (
									<div className="absolute inset-0 flex items-center justify-center">
										<ProgressCircle aria-label={t("Pending...")} isIndeterminate={true} />
									</div>
								) : null}
							</div>
						) : isPending ? (
							<div className="flex items-center justify-center py-6">
								<ProgressCircle aria-label={t("Pending...")} isIndeterminate={true} />
							</div>
						) : (
							<p className="py-3 text-center text-sm text-muted-fg">
								{emptyMessage ?? t("No options found.")}
							</p>
						)}

						{hasPrev || hasNext ? (
							<div className="flex justify-between gap-2">
								<Button
									intent="outline"
									isDisabled={!hasPrev || isPending}
									onPress={handlePrev}
									type="button"
								>
									{t("Previous page")}
								</Button>
								<Button
									intent="outline"
									isDisabled={!hasNext || isPending}
									onPress={handleNext}
									type="button"
								>
									{t("Next page")}
								</Button>
							</div>
						) : null}
					</div>
				</AriaPopover>
			</AriaDialogTrigger>

			{errorMessage != null && errorMessage !== "" ? (
				<div className={fieldErrorStyles()}>{errorMessage}</div>
			) : null}
		</div>
	);
}
