"use client";

import { CheckIcon } from "@heroicons/react/20/solid";
import { Fragment, type ReactNode } from "react";
import {
	ListBox as AriaListBox,
	ListBoxItem as AriaListBoxItem,
	type ListBoxItemProps as AriaListBoxItemProps,
	type ListBoxProps as AriaListBoxProps,
	composeRenderProps,
} from "react-aria-components";
import { twJoin, twMerge } from "tailwind-merge";

import {
	DropdownDescription,
	DropdownLabel,
	DropdownSection,
	type DropdownSectionProps,
	dropdownItemStyles,
} from "@/lib/dropdown";
import { cx } from "@/lib/primitive";

export interface ListBoxProps<T extends object> extends AriaListBoxProps<T> {}

export function ListBox<T extends object>(props: Readonly<ListBoxProps<T>>): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaListBox
			{...rest}
			className={cx(
				"grid max-block-96 inline-full min-inline-56 scroll-py-1 grid-cols-[auto_1fr] flex-col gap-y-1 overflow-y-auto overscroll-contain rounded-xl border bg-bg p-1 outline-hidden scrollbar-thin *:[[role='group']+[role=group]]:mbs-4 *:[[role='group']+[role=separator]]:mbs-1 has-data-[slot=drag-icon]:grid-cols-[auto_auto_1fr] [&::-webkit-scrollbar]:block-0.5 [&::-webkit-scrollbar]:inline-0.5",
				className,
			)}
		/>
	);
}

export interface ListBoxItemProps<T extends object> extends AriaListBoxItemProps<T> {}

export function ListBoxItem<T extends object>(props: Readonly<ListBoxItemProps<T>>): ReactNode {
	const { children, className, ...rest } = props;

	const textValue = typeof children === "string" ? children : undefined;

	return (
		<AriaListBoxItem
			className={composeRenderProps(className, (className, renderProps) =>
				dropdownItemStyles({
					...renderProps,
					className: twJoin(
						"group",
						"has-data-[slot=drag-icon]:*:[[slot=label]]:col-start-3",
						"has-data-[slot=drag-icon]:*:data-[slot=icon]:col-start-2",
						"href" in props ? "cursor-pointer" : "cursor-default",
						className,
					),
				}),
			)}
			data-slot="list-box-item"
			textValue={textValue}
			{...rest}
		>
			{(renderProps) => {
				const { allowsDragging, isSelected } = renderProps;

				return (
					<Fragment>
						{allowsDragging === true ? (
							<svg
								className="me-2 inline-5 block-lh text-muted-fg sm:inline-4"
								data-slot="drag-icon"
								fill="none"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M11 5.5C11 6.32843 10.3284 7 9.5 7C8.67157 7 8 6.32843 8 5.5C8 4.67157 8.67157 4 9.5 4C10.3284 4 11 4.67157 11 5.5Z"
									fill="currentColor"
								/>
								<path
									d="M16 5.5C16 6.32843 15.3284 7 14.5 7C13.6716 7 13 6.32843 13 5.5C13 4.67157 13.6716 4 14.5 4C15.3284 4 16 4.67157 16 5.5Z"
									fill="currentColor"
								/>
								<path
									d="M11 18.5C11 19.3284 10.3284 20 9.5 20C8.67157 20 8 19.3284 8 18.5C8 17.6716 8.67157 17 9.5 17C10.3284 17 11 17.6716 11 18.5Z"
									fill="currentColor"
								/>
								<path
									d="M16 18.5C16 19.3284 15.3284 20 14.5 20C13.6716 20 13 19.3284 13 18.5C13 17.6716 13.6716 17 14.5 17C15.3284 17 16 17.6716 16 18.5Z"
									fill="currentColor"
								/>
								<path
									d="M11 12C11 12.8284 10.3284 13.5 9.5 13.5C8.67157 13.5 8 12.8284 8 12C8 11.1716 8.67157 10.5 9.5 10.5C10.3284 10.5 11 11.1716 11 12Z"
									fill="currentColor"
								/>
								<path
									d="M16 12C16 12.8284 15.3284 13.5 14.5 13.5C13.6716 13.5 13 12.8284 13 12C13 11.1716 13.6716 10.5 14.5 10.5C15.3284 10.5 16 11.1716 16 12Z"
									fill="currentColor"
								/>
							</svg>
						) : null}
						{isSelected ? (
							<CheckIcon
								className={twJoin(
									"-mx-0.5 me-2 block-4 inline-4 shrink-0 group-allows-dragging:col-start-2 sm:inline-4",
									"group-has-[[slot=description]]:self-start group-has-[[slot=description]]:mbs-1",
									"group-has-data-[slot=icon]:absolute group-has-data-[slot=icon]:inset-bs-1/2 group-has-data-[slot=icon]:inset-e-0.5 group-has-data-[slot=icon]:-translate-y-1/2",
									"sm:group-has-data-[slot=icon]:group-has-[[slot=description]]:inset-bs-2.5 group-has-data-[slot=icon]:group-has-[[slot=description]]:inset-bs-3 group-has-data-[slot=icon]:group-has-[[slot=description]]:translate-y-0",
									"group-has-data-[slot=avatar]:absolute group-has-data-[slot=avatar]:inset-bs-1/2 group-has-data-[slot=avatar]:inset-e-0.5 group-has-data-[slot=avatar]:-translate-y-1/2",
									"sm:group-has-data-[slot=avatar]:group-has-[[slot=description]]:inset-bs-2.5 group-has-data-[slot=avatar]:group-has-[[slot=description]]:inset-bs-3 group-has-data-[slot=avatar]:group-has-[[slot=description]]:translate-y-0",
								)}
								data-slot="check-icon"
							/>
						) : null}
						{typeof children === "function" ? (
							children(renderProps)
						) : typeof children === "string" ? (
							<DropdownLabel>{children}</DropdownLabel>
						) : (
							children
						)}
					</Fragment>
				);
			}}
		</AriaListBoxItem>
	);
}

export interface ListBoxSectionProps<T extends object> extends DropdownSectionProps<T> {}

export function ListBoxSection<T extends object>(
	props: Readonly<ListBoxSectionProps<T>>,
): ReactNode {
	const { className, ...rest } = props;

	return (
		<DropdownSection
			className={twMerge("gap-y-1 *:data-[slot=list-box-item]:last:-mbe-1.5", className)}
			{...rest}
		/>
	);
}

export const ListBoxLabel = DropdownLabel;
export const ListBoxDescription = DropdownDescription;
