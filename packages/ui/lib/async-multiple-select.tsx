"use client";

import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { useResizeObserver } from "@react-aria/utils";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
	Button as AriaButton,
	DialogTrigger as AriaDialogTrigger,
	Popover as AriaPopover,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { Button } from "@/lib/button";
import { Label, fieldErrorStyles, fieldStyles } from "@/lib/field";
import { ListBox, ListBoxDescription, ListBoxItem, ListBoxLabel } from "@/lib/list-box";
import { cx } from "@/lib/primitive";
import { ProgressCircle } from "@/lib/progress-circle";
import { SearchField, SearchInput } from "@/lib/search-field";
import { Tag, TagGroup, TagList } from "@/lib/tag-group";
import {
	type AsyncOption,
	type AsyncOptionsFetchPage,
	useAsyncOptions,
} from "@/lib/use-async-options";

const defaultPageSize = 20;
const emptySelectedItems: Array<never> = [];

export interface AsyncMultipleSelectProps<T extends AsyncOption> {
	"aria-label": string;
	emptyMessage?: string;
	errorMessage?: string;
	fetchPage: AsyncOptionsFetchPage<T>;
	initialItems: Array<T>;
	initialTotal: number;
	inputPlaceholder?: string;
	isDisabled?: boolean;
	label?: string;
	onChange: (ids: Array<string>) => void;
	pageSize?: number;
	placeholder?: string;
	renderItem?: (item: T) => ReactNode;
	selectedItems?: Array<T>;
	value: Array<string>;
	cacheKey?: string | number;
}

function renderDefaultItem(item: AsyncOption): ReactNode {
	if (item.description == null || item.description === "") {
		return <ListBoxLabel>{item.name}</ListBoxLabel>;
	}

	return (
		<Fragment>
			<ListBoxLabel>{item.name}</ListBoxLabel>
			<ListBoxDescription>{item.description}</ListBoxDescription>
		</Fragment>
	);
}

export function AsyncMultipleSelect<T extends AsyncOption>(
	props: Readonly<AsyncMultipleSelectProps<T>>,
): ReactNode {
	const { cacheKey, ...rest } = props;

	return <AsyncMultipleSelectInner key={String(cacheKey ?? "default")} {...rest} />;
}

interface AsyncMultipleSelectInnerProps<T extends AsyncOption> extends Omit<
	AsyncMultipleSelectProps<T>,
	"cacheKey"
> {}

function AsyncMultipleSelectInner<T extends AsyncOption>(
	props: Readonly<AsyncMultipleSelectInnerProps<T>>,
): ReactNode {
	const {
		"aria-label": ariaLabel,
		emptyMessage,
		errorMessage,
		fetchPage,
		initialItems,
		initialTotal,
		inputPlaceholder,
		isDisabled = false,
		label,
		onChange,
		pageSize = defaultPageSize,
		placeholder,
		renderItem,
		selectedItems = emptySelectedItems,
		value,
	} = props;

	const t = useExtracted("ui");

	const triggerRef = useRef<HTMLDivElement | null>(null);
	const [triggerWidth, setTriggerWidth] = useState<string | undefined>();
	const [isOpen, setIsOpen] = useState(false);
	const [localSelectedItems, setLocalSelectedItems] = useState<Array<T>>(emptySelectedItems);

	const onResize = useCallback(() => {
		if (triggerRef.current) {
			setTriggerWidth(`${triggerRef.current.offsetWidth}px`);
		}
	}, []);
	useResizeObserver({ ref: triggerRef, onResize });

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
	} = useAsyncOptions({
		fetchPage,
		initialItems,
		initialTotal,
		pageSize,
	});

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

	const renderOption = renderItem ?? renderDefaultItem;
	const loadErrorMessage =
		loadError != null && loadError.message !== ""
			? loadError.message
			: t("Could not load options.");

	return (
		<div className={fieldStyles({ className: "group/select" })} data-slot="control">
			{label != null ? <Label>{label}</Label> : null}

			<AriaDialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
				<div
					ref={triggerRef}
					className={twMerge(
						"flex inline-full items-center gap-2 rounded-lg border border-input p-1",
						"has-[:focus-visible]:border-ring/70 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/20",
						isOpen ? "border-ring/70 ring-3 ring-ring/20" : undefined,
						isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
					)}
					data-slot="control"
					onClick={(event) => {
						if (isDisabled) {
							return;
						}

						const target = event.target as HTMLElement;
						if (target.closest("button, [role='row'], [role='gridcell']") != null) {
							return;
						}

						setIsOpen(true);
					}}
				>
					<TagGroup
						aria-label={t("Selected items")}
						className="min-inline-0 flex-1"
						onRemove={
							isDisabled
								? undefined
								: (keys) => {
										onChange(value.filter((id) => !keys.has(id)));
									}
						}
					>
						<TagList
							items={resolvedSelectedItems}
							renderEmptyState={() => (
								<i className="ps-2 text-muted-fg text-sm not-italic">
									{placeholder ?? t("No selected items")}
								</i>
							)}
						>
							{(item) => <Tag className="rounded-md">{item.name}</Tag>}
						</TagList>
					</TagGroup>
					<AriaButton
						aria-label={t("Open options")}
						className="grid block-7 inline-7 shrink-0 cursor-default place-content-center rounded-[calc(var(--radius-lg)-(--spacing(1)))] text-muted-fg hover:bg-muted hover:text-fg"
						isDisabled={isDisabled}
					>
						<ChevronUpDownIcon className="block-4 inline-4" data-slot="chevron" />
					</AriaButton>
				</div>

				<AriaPopover
					className={cx(
						"group/popover origin-(--trigger-anchor-point) rounded-xl border border-fg/10 bg-overlay text-overlay-fg shadow-xs outline-hidden",
						"inline-(--trigger-width)",
						"entering:fade-in entering:animate-in",
						"exiting:fade-out exiting:animate-out",
					)}
					placement="bottom"
					style={
						triggerWidth != null
							? ({ "--trigger-width": triggerWidth } as React.CSSProperties)
							: undefined
					}
					triggerRef={triggerRef}
				>
					<div className="flex flex-col gap-3 p-3">
						<SearchField onChange={setSearchText} onSubmit={handleSearch} value={searchText}>
							<SearchInput autoFocus={true} placeholder={inputPlaceholder ?? t("Search")} />
						</SearchField>

						{loadError != null ? (
							<p className="py-3 text-center text-danger-subtle-fg text-sm">{loadErrorMessage}</p>
						) : displayedItems.length > 0 ? (
							<div className="relative">
								<ListBox
									aria-label={ariaLabel}
									className={cx(
										"max-block-72 [&::-webkit-scrollbar]:block-2! [&::-webkit-scrollbar]:inline-2!",
										isPending ? "opacity-50" : undefined,
									)}
									items={displayedItems}
									onSelectionChange={(keys) => {
										if (keys === "all") {
											return;
										}

										const nextValue = [...keys].map(String);
										const nextSelectedKeys = new Set(nextValue);

										setLocalSelectedItems((previousItems) => {
											const map = new Map(previousItems.map((item) => [item.id, item] as const));

											for (const item of displayedItems) {
												if (nextSelectedKeys.has(item.id)) {
													map.set(item.id, item);
												}
											}

											return [...map.values()];
										});

										onChange(nextValue);
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
							<p className="py-3 text-center text-muted-fg text-sm">
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
