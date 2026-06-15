"use client";

import { useExtracted } from "next-intl";
import { type ComponentProps, Fragment, type ReactNode } from "react";
import {
	Button,
	GridListHeader as GridListHeaderPrimitive,
	GridListItem as GridListItemPrimitive,
	type GridListItemProps,
	GridList as GridListPrimitive,
	type GridListProps,
	GridListSection as GridListSectionPrimitive,
	Text,
	type TextProps,
	composeRenderProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { cx } from "@/lib/primitive";

import { Checkbox } from "./checkbox";

export function GridList<T extends object>({
	className,
	...props
}: Readonly<GridListProps<T>>): ReactNode {
	return (
		<GridListPrimitive
			className={cx(
				"relative flex flex-col gap-y-1 sm:text-sm/6 *:drop-target:border *:drop-target:border-accent has-data-[slot=grid-list-section]:gap-y-6",
				className,
			)}
			data-slot="grid-list"
			{...props}
		/>
	);
}

export function GridListSection<T extends object>({
	className,
	...props
}: Readonly<ComponentProps<typeof GridListSectionPrimitive<T>>>): ReactNode {
	return (
		<GridListSectionPrimitive
			className={twMerge("space-y-1", className)}
			data-slot="grid-list-section"
			{...props}
		/>
	);
}

export function GridListHeader({
	className,
	...props
}: Readonly<ComponentProps<typeof GridListHeaderPrimitive>>): ReactNode {
	return (
		<GridListHeaderPrimitive
			className={twMerge("mbe-2 font-semibold text-sm/6", className)}
			data-slot="grid-list-header"
			{...props}
		/>
	);
}

export function GridListItem({
	className,
	children,
	...props
}: Readonly<GridListItemProps>): ReactNode {
	const t = useExtracted("ui");

	const textValue = typeof children === "string" ? children : undefined;

	return (
		<GridListItemPrimitive
			textValue={textValue}
			{...props}
			className={composeRenderProps(
				className,
				(className, { isHovered, isFocusVisible, isSelected }) =>
					twMerge(
						"[--grid-list-item-bg-active:var(--color-primary-subtle)] [--grid-list-item-text-active:var(--color-primary-subtle-fg)]",
						"group inset-ring inset-ring-border rounded-lg px-3 py-2.5",
						"relative min-inline-0 outline-hidden [--mr-icon:--spacing(2)]",
						"flex min-inline-0 cursor-default items-center gap-2 sm:gap-2.5",
						"dragging:cursor-grab dragging:opacity-70 dragging:**:[[slot=drag]]:text-(--grid-list-item-text-active)",
						"**:data-[slot=icon]:block-5 **:data-[slot=icon]:inline-5 **:data-[slot=icon]:shrink-0 **:data-[slot=icon]:text-muted-fg sm:**:data-[slot=icon]:block-4 sm:**:data-[slot=icon]:inline-4",
						(isSelected || isHovered || isFocusVisible) &&
							"inset-ring-ring/70 bg-(--grid-list-item-bg-active) text-(--grid-list-item-text-active) **:[.text-muted-fg]:text-(--grid-list-item-text-active)/60",
						"href" in props && "cursor-pointer",
						className,
					),
			)}
		>
			{(values) => (
				<Fragment>
					{values.allowsDragging === true && (
						<Button aria-label={t("Reorder item")} slot="drag">
							<svg
								className="block-5 inline-5 text-muted-fg sm:block-4 sm:inline-4"
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
						</Button>
					)}

					{values.selectionMode === "multiple" && values.selectionBehavior === "toggle" && (
						<Checkbox
							className="[--indicator-mt:0] *:gap-x-0 sm:[--indicator-mt:0]"
							slot="selection"
						/>
					)}
					{typeof children === "function" ? children(values) : children}
				</Fragment>
			)}
		</GridListItemPrimitive>
	);
}

export function GridListEmptyState({
	ref,
	className,
	...props
}: Readonly<ComponentProps<"div">>): ReactNode {
	return <div ref={ref} className={twMerge("p-6", className)} {...props} />;
}

export function GridListSpacer({
	className,
	ref,
	...props
}: Readonly<ComponentProps<"div">>): ReactNode {
	return (
		<div ref={ref} aria-hidden={true} className={twMerge("-ms-4 flex-1", className)} {...props} />
	);
}

export function GridListStart({
	className,
	ref,
	...props
}: Readonly<ComponentProps<"div">>): ReactNode {
	return (
		<div
			ref={ref}
			className={twMerge("relative flex items-center gap-x-2.5 sm:gap-x-3", className)}
			{...props}
		/>
	);
}

export interface GridListTextProps extends TextProps {}

export function GridListLabel({ className, ...props }: Readonly<GridListTextProps>): ReactNode {
	return <Text className={twMerge("font-medium", className)} {...props} />;
}

export function GridListDescription({
	className,
	...props
}: Readonly<GridListTextProps>): ReactNode {
	return (
		<Text
			className={twMerge("font-normal text-muted-fg text-sm", className)}
			slot="description"
			{...props}
		/>
	);
}

export type { GridListItemProps, GridListProps };
