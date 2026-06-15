"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import { useResizeObserver } from "@react-aria/utils";
import { useExtracted } from "next-intl";
import React, {
	Children,
	Fragment,
	type ReactNode,
	isValidElement,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Autocomplete,
	Select,
	type SelectProps,
	SelectValue,
	useFilter,
} from "react-aria-components";

import { Button } from "@/lib/button";
import { fieldStyles } from "@/lib/field";
import { ListBox, ListBoxItem } from "@/lib/list-box";
import { PopoverContent } from "@/lib/popover";
import { cx } from "@/lib/primitive";
import { SearchField, SearchInput } from "@/lib/search-field";
import { Tag, TagGroup, TagList } from "@/lib/tag-group";

interface OptionBase {
	id: string | number;
	name: string;
}

interface MultipleSelectProps<T extends OptionBase> extends Omit<
	SelectProps<T, "multiple">,
	"selectionMode" | "children"
> {
	placeholder?: string;
	searchPlaceholder?: string;
	className?: string;
	children?: React.ReactNode;
	name?: string;
}

interface MultipleSelectContentProps<T extends OptionBase> {
	items: Iterable<T>;
	children: (item: T) => React.ReactNode;
}

export function MultipleSelectContent<T extends OptionBase>(
	_props: Readonly<MultipleSelectContentProps<T>>,
): ReactNode {
	return null;
}

MultipleSelectContent.displayName = "MultipleSelectContent";

export function MultipleSelect<T extends OptionBase>(
	props: Readonly<MultipleSelectProps<T>>,
): ReactNode {
	const {
		placeholder = "No selected items",
		searchPlaceholder,
		className,
		children,
		name,
		...rest
	} = props;

	const t = useExtracted("ui");

	const triggerRef = useRef<HTMLDivElement | null>(null);
	const [triggerWidth, setTriggerWidth] = useState<string | undefined>();

	const onResize = useCallback(() => {
		if (triggerRef.current) {
			setTriggerWidth(`${triggerRef.current.offsetWidth}px`);
		}
	}, []);

	useResizeObserver({ ref: triggerRef, onResize });

	const { contains } = useFilter({ sensitivity: "base" });

	const { before, after, list } = useMemo(() => {
		const arr = Children.toArray(children);
		const idx = arr.findIndex(
			// @ts-expect-error -- display name
			// oxlint-disable-next-line typescript/no-unnecessary-condition
			(c) => isValidElement(c) && c.type?.displayName === "MultipleSelectContent",
		);
		if (idx === -1) {
			return { before: arr, after: [], list: null as null | MultipleSelectContentProps<T> };
		}
		const el = arr[idx] as React.ReactElement<MultipleSelectContentProps<T>>;
		return { before: arr.slice(0, idx), after: arr.slice(idx + 1), list: el.props };
	}, [children]);

	return (
		<Select
			className={cx(fieldStyles({ className: "group/select" }), className)}
			data-slot="control"
			name={name}
			selectionMode="multiple"
			{...rest}
		>
			{before}
			{list && (
				<Fragment>
					<div
						ref={triggerRef}
						className="flex inline-full items-center gap-2 rounded-lg border border-input p-1 group-open/select:border-ring/70 group-open/select:ring-3 group-open/select:ring-ring/20 has-[:focus-visible]:border-ring/70 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/20"
						data-slot="control"
					>
						<SelectValue<T> className="flex-1 min-inline-0">
							{({ selectedItems, state }) => (
								<TagGroup
									aria-label={t("Selected items")}
									onRemove={(keys) => {
										if (Array.isArray(state.value)) {
											// oxlint-disable-next-line typescript/no-unsafe-argument
											state.setValue(state.value.filter((k) => !keys.has(k)));
										}
									}}
								>
									<TagList
										items={selectedItems.filter((i) => i != null)}
										renderEmptyState={() => (
											<i className="ps-2 text-muted-fg text-sm not-italic">{placeholder}</i>
										)}
									>
										{(item) => <Tag className="rounded-md">{item.name}</Tag>}
									</TagList>
								</TagGroup>
							)}
						</SelectValue>
						<Button
							aria-label={t("Open options")}
							className="rounded-[calc(var(--radius-lg)-(--spacing(1)))]"
							intent="secondary"
							size="sq-xs"
						>
							<PlusIcon />
						</Button>
					</div>
					<PopoverContent
						className="flex inline-(--trigger-width) max-inline-none flex-col overflow-hidden p-0"
						placement="bottom"
						style={
							triggerWidth != null
								? ({ "--trigger-width": triggerWidth } as React.CSSProperties)
								: undefined
						}
						triggerRef={triggerRef}
					>
						<Autocomplete filter={contains}>
							<SearchField
								autoFocus={true}
								className="rounded-none border-be border-fg/10 py-0.5 outline-hidden"
							>
								<SearchInput
									className="border-none outline-hidden focus:ring-0"
									placeholder={searchPlaceholder ?? t("Search")}
								/>
							</SearchField>
							<ListBox
								className="grid min-block-0 inline-full flex-1 grid-cols-[auto_1fr] gap-y-1 overflow-y-auto rounded-none border-0 bg-transparent p-1 shadow-none outline-hidden"
								items={list.items}
							>
								{list.children}
							</ListBox>
						</Autocomplete>
					</PopoverContent>
				</Fragment>
			)}
			{after}
		</Select>
	);
}

export const MultipleSelectItem = ListBoxItem;
