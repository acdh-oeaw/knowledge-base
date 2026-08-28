"use client";

import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { useExtracted } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import {
	Button as AriaButton,
	ComboBox as AriaComboBox,
	type ComboBoxProps as AriaComboBoxProps,
	ListBox as AriaListBox,
	type ListBoxProps as AriaListBoxProps,
	type PopoverProps as AriaPopoverProps,
} from "react-aria-components";

import {
	DropdownDescription,
	DropdownItem,
	DropdownLabel,
	DropdownSection,
	DropdownSeparator,
} from "@/lib/dropdown";
import { fieldStyles } from "@/lib/field";
import { Input } from "@/lib/input";
import { PopoverContent } from "@/lib/popover";
import { cx } from "@/lib/primitive";

export interface SearchableSelectProps<
	T extends object,
	M extends "single" | "multiple" = "single",
> extends AriaComboBoxProps<T, M> {}

export function SearchableSelect<T extends object, M extends "single" | "multiple" = "single">(
	props: Readonly<SearchableSelectProps<T, M>>,
): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaComboBox
			className={cx(fieldStyles({ className: "group/select" }), className)}
			data-slot="control"
			{...rest}
		/>
	);
}

export interface SearchableSelectContentProps<T extends object> extends Omit<
	AriaListBoxProps<T>,
	"layout" | "orientation"
> {
	items?: Iterable<T>;
	popover?: Omit<AriaPopoverProps, "children">;
}

export function SearchableSelectContent<T extends object>(
	props: Readonly<SearchableSelectContentProps<T>>,
): ReactNode {
	const { items, className, popover, ...rest } = props;

	return (
		<PopoverContent
			className={cx(
				"overflow-hidden p-0 inline-(--trigger-width) max-inline-none",
				popover?.className,
			)}
			placement={popover?.placement ?? "bottom"}
			{...popover}
		>
			<AriaListBox
				className={cx(
					"grid grid-cols-[auto_1fr] flex-col gap-y-1 overflow-y-auto p-1 outline-hidden inline-full max-block-96 *:[[role='group']+[role=group]]:mbs-4 *:[[role='group']+[role=separator]]:mbs-1",
					className,
				)}
				items={items}
				layout="stack"
				orientation="vertical"
				{...rest}
			/>
		</PopoverContent>
	);
}

export interface SearchableSelectInputProps extends ComponentProps<typeof Input> {}

export function SearchableSelectInput(props: Readonly<SearchableSelectInputProps>): ReactNode {
	const { className, ...rest } = props;
	const t = useExtracted("ui");

	return (
		<span className="relative isolate block" data-slot="control">
			<Input className={cx("pe-10", className)} {...rest} />
			<AriaButton
				aria-label={t("Open options")}
				className="absolute inset-e-0 inset-bs-0 inset-be-0 grid cursor-default place-content-center px-3 text-muted-fg hover:text-fg sm:px-2.5 pressed:text-fg"
			>
				<ChevronUpDownIcon
					className="block-5 inline-5 sm:block-4 sm:inline-4"
					data-slot="chevron"
				/>
			</AriaButton>
		</span>
	);
}

export const SearchableSelectSection = DropdownSection;
export const SearchableSelectSeparator = DropdownSeparator;
export const SearchableSelectLabel = DropdownLabel;
export const SearchableSelectDescription = DropdownDescription;
export const SearchableSelectItem = DropdownItem;
