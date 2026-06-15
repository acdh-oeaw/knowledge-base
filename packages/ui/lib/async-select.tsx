"use client";

import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { useResizeObserver } from "@react-aria/utils";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useCallback, useRef, useState } from "react";
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
import {
	type AsyncOption,
	type AsyncOptionsFetchPage,
	useAsyncOptions,
} from "@/lib/use-async-options";

const defaultPageSize = 20;

export interface AsyncSelectProps<T extends AsyncOption> {
	"aria-label": string;
	emptyMessage?: string;
	errorMessage?: string;
	fetchPage: AsyncOptionsFetchPage<T>;
	initialItems: Array<T>;
	initialTotal: number;
	inputPlaceholder?: string;
	isDisabled?: boolean;
	isRequired?: boolean;
	label?: string;
	loadOnMount?: boolean;
	onSelect: (item: T) => void;
	pageSize?: number;
	placeholder: string;
	renderItem?: (item: T) => ReactNode;
	selectedItem: T | null;
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

export function AsyncSelect<T extends AsyncOption>(
	props: Readonly<AsyncSelectProps<T>>,
): ReactNode {
	const { cacheKey, ...rest } = props;

	return <AsyncSelectInner key={String(cacheKey ?? "default")} {...rest} />;
}

interface AsyncSelectInnerProps<T extends AsyncOption> extends Omit<
	AsyncSelectProps<T>,
	"cacheKey"
> {}

function AsyncSelectInner<T extends AsyncOption>(
	props: Readonly<AsyncSelectInnerProps<T>>,
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
		isRequired = false,
		label,
		loadOnMount = false,
		onSelect,
		pageSize = defaultPageSize,
		placeholder,
		renderItem,
		selectedItem,
	} = props;

	const t = useExtracted("ui");

	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const [triggerWidth, setTriggerWidth] = useState<string | undefined>();
	const [isOpen, setIsOpen] = useState(false);

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

	const renderOption = renderItem ?? renderDefaultItem;
	const loadErrorMessage =
		loadError != null && loadError.message !== ""
			? loadError.message
			: t("Could not load options.");

	return (
		<div
			className={fieldStyles({ className: "group/select" })}
			data-required={isRequired || undefined}
			data-slot="control"
		>
			{label != null ? <Label>{label}</Label> : null}

			<AriaDialogTrigger
				isOpen={isOpen}
				onOpenChange={(open) => {
					setIsOpen(open);

					if (open && loadOnMount && initialItems.length === 0) {
						handleSearch();
					}
				}}
			>
				<AriaButton
					ref={triggerRef}
					aria-required={isRequired || undefined}
					className={cx(
						"group/select-trigger flex inline-full min-inline-0 cursor-default items-center gap-x-2 rounded-lg border border-input px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] text-start text-fg outline-hidden transition duration-200 sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6",
						"hover:border-muted-fg/30",
						"focus:border-ring/70 focus:bg-primary-subtle/5 focus:ring-3 focus:ring-ring/20",
						isOpen ? "border-ring/70 bg-primary-subtle/5 ring-3 ring-ring/20" : undefined,
						isDisabled ? "opacity-50" : undefined,
					)}
					isDisabled={isDisabled}
				>
					<span
						className={twMerge(
							"flex-1 truncate text-start",
							selectedItem == null ? "text-muted-fg" : undefined,
						)}
					>
						{selectedItem?.name ?? placeholder}
					</span>
					<ChevronUpDownIcon
						className="block-5 inline-5 shrink-0 text-muted-fg sm:block-4 sm:inline-4"
						data-slot="chevron"
					/>
				</AriaButton>

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

										const [first] = [...keys];

										if (first == null) {
											return;
										}

										const item = displayedItems.find((entry) => entry.id === first);

										if (item == null) {
											return;
										}

										onSelect(item);
										setIsOpen(false);
									}}
									selectedKeys={selectedItem != null ? new Set([selectedItem.id]) : new Set()}
									selectionMode="single"
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
