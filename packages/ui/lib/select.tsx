"use client";

import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { type ComponentProps, Fragment, type ReactNode } from "react";
import {
	Button as AriaButton,
	ListBox as AriaListBox,
	type ListBoxProps as AriaListBoxProps,
	type PopoverProps as AriaPopoverProps,
	Select as AriaSelect,
	type SelectProps as AriaSelectProps,
	SelectValue as AriaSelectValue,
} from "react-aria-components";
import { twJoin } from "tailwind-merge";

import {
	DropdownDescription,
	DropdownItem,
	DropdownLabel,
	DropdownSection,
	DropdownSeparator,
} from "@/lib/dropdown";
import { fieldStyles } from "@/lib/field";
import { PopoverContent } from "@/lib/popover";
import { cx } from "@/lib/primitive";

export interface SelectProps<
	T extends object,
	M extends "single" | "multiple" = "single",
> extends AriaSelectProps<T, M> {
	items?: Iterable<T, M>;
}

export function Select<T extends object, M extends "single" | "multiple" = "single">(
	props: Readonly<SelectProps<T, M>>,
): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaSelect
			className={cx(fieldStyles({ className: "group/select" }), className)}
			data-slot="control"
			{...rest}
		/>
	);
}

export interface SelectContentProps<T extends object> extends Omit<
	AriaListBoxProps<T>,
	"layout" | "orientation"
> {
	items?: Iterable<T>;
	popover?: Omit<AriaPopoverProps, "children">;
}

export function SelectContent<T extends object>(props: Readonly<SelectContentProps<T>>): ReactNode {
	const { items, className, popover, ...rest } = props;

	return (
		<PopoverContent
			className={cx(
				"min-inline-(--trigger-width) scroll-py-1 overflow-y-auto overscroll-contain",
				popover?.className,
			)}
			placement={popover?.placement ?? "bottom"}
			{...popover}
		>
			<AriaListBox
				className={cx(
					"grid max-block-96 inline-full grid-cols-[auto_1fr] flex-col gap-y-1 p-1 outline-hidden *:[[role='group']+[role=group]]:mbs-4 *:[[role='group']+[role=separator]]:mbs-1",
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

export interface SelectTriggerProps extends ComponentProps<typeof AriaButton> {
	prefix?: React.ReactNode;
	className?: string;
}

export function SelectTrigger(props: Readonly<SelectTriggerProps>): ReactNode {
	const { children, className, prefix, ...rest } = props;

	return (
		<span className="relative block inline-full" data-slot="control">
			<AriaButton
				className={cx(
					[
						"group/select-trigger flex inline-full min-inline-0 cursor-default items-center gap-x-2 rounded-lg border border-input px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] text-start text-fg outline-hidden transition duration-200 sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6 sm:*:text-sm/6 dark:shadow-none",
						"group-disabled/select:opacity-50 forced-colors:group-disabled/select:border-[GrayText] forced-colors:group-disabled/select:text-[GrayText]",
						"focus:border-ring/70 focus:bg-primary-subtle/5 focus:ring-3 focus:ring-ring/20",
						"hover:border-muted-fg/30 group-hover/select:invalid:border-danger-subtle-fg/70",
						"group-open/select:border-ring/70 group-open/select:bg-primary-subtle/5 group-open/select:ring-3 group-open/select:ring-ring/20 group-open/select:hover:border-ring/70",
						"group-invalid/select:border-danger-subtle-fg/70 group-invalid/select:bg-danger-subtle/5 group-invalid/select:ring-danger-subtle-fg/20 group-invalid/select:hover:border-danger-subtle-fg/70 group-open/select:invalid:border-danger-subtle-fg/70 group-open/select:invalid:bg-danger-subtle/5 group-open/select:invalid:ring-3 group-open/select:invalid:ring-danger-subtle-fg/20 group-focus/select:group-invalid/select:border-danger-subtle-fg/70 group-focus/select:group-invalid/select:ring-danger-subtle-fg/20",
						"forced-colors:[--btn-icon:ButtonText] forced-colors:hover:[--btn-icon:ButtonText] *:data-[slot=icon]:block-5 *:data-[slot=icon]:inline-5 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:self-center *:data-[slot=icon]:text-(--btn-icon) pressed:*:data-[slot=icon]:text-(--btn-icon-active) focus-visible:*:data-[slot=icon]:text-(--btn-icon-active)/80 hover:*:data-[slot=icon]:text-(--btn-icon-active)/90 sm:*:data-[slot=icon]:block-4 sm:*:data-[slot=icon]:inline-4",
						"*:data-[slot=loader]:block-5 *:data-[slot=loader]:inline-5 *:data-[slot=loader]:shrink-0 *:data-[slot=loader]:self-center *:data-[slot=loader]:text-(--btn-icon) sm:*:data-[slot=loader]:block-4 sm:*:data-[slot=loader]:inline-4",
						"forced-colors:group-focus/select:border-[Highlight] forced-colors:group-focus/select:group-invalid/select:border-[Mark] forced-colors:group-invalid/select:border-[Mark]",
					],
					className,
				)}
				{...rest}
			>
				{(values) => (
					<Fragment>
						{prefix != null ? <span className="text-muted-fg">{prefix}</span> : null}
						{typeof children === "function" ? children(values) : children}

						{children == null ? (
							<Fragment>
								<AriaSelectValue
									className={twJoin([
										"truncate text-start data-placeholder:text-muted-fg sm:text-sm/6 **:[[slot=description]]:hidden",
										"has-data-[slot=avatar]:grid has-data-[slot=avatar]:grid-cols-[1fr_auto] has-data-[slot=avatar]:items-center has-data-[slot=avatar]:gap-x-2",
										"has-data-[slot=icon]:grid has-data-[slot=icon]:grid-cols-[1fr_auto] has-data-[slot=icon]:items-center has-data-[slot=icon]:gap-x-2",
										"*:data-[slot=icon]:block-5 *:data-[slot=icon]:inline-5 sm:*:data-[slot=icon]:block-4 sm:*:data-[slot=icon]:inline-4",
										"*:data-[slot=avatar]:[--avatar-size:--spacing(5)] sm:*:data-[slot=avatar]:[--avatar-size:--spacing(4.5)]",
									])}
									data-slot="select-value"
								/>
								<ChevronUpDownIcon
									className="-me-1 ms-auto block-5 inline-5 text-muted-fg sm:block-4 sm:inline-4"
									data-slot="chevron"
								/>
							</Fragment>
						) : null}
					</Fragment>
				)}
			</AriaButton>
		</span>
	);
}

export const SelectSection = DropdownSection;
export const SelectSeparator = DropdownSeparator;
export const SelectLabel = DropdownLabel;
export const SelectDescription = DropdownDescription;
export const SelectItem = DropdownItem;
