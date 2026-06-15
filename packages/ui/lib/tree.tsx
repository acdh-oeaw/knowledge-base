"use client";

import { ChevronRightIcon } from "@heroicons/react/20/solid";
import type { ReactNode } from "react";
import {
	Button as AriaButton,
	Tree as AriaTree,
	TreeItem as AriaTreeItem,
	TreeItemContent as AriaTreeItemContent,
	type TreeItemContentProps as AriaTreeItemContentProps,
	type TreeItemContentRenderProps as AriaTreeItemContentRenderProps,
	type TreeItemProps as AriaTreeItemProps,
	type TreeProps as AriaTreeProps,
} from "react-aria-components";
import { twJoin, twMerge } from "tailwind-merge";

import { Checkbox } from "@/lib/checkbox";
import { cx } from "@/lib/primitive";

export interface TreeProps<T extends object> extends AriaTreeProps<T> {}

export function Tree<T extends object>(props: Readonly<TreeProps<T>>): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaTree
			{...rest}
			className={cx(
				twJoin(
					"flex cursor-default flex-col gap-y-2 overflow-auto outline-hidden forced-color-adjust-none",
					"[--tree-active-bg:var(--color-primary-subtle)] [--tree-active-fg:var(--color-primary-subtle-fg)]",
				),
				className,
			)}
		/>
	);
}

export interface TreeItemProps<T extends object> extends AriaTreeItemProps<T> {}

export function TreeItem<T extends object>(props: Readonly<TreeItemProps<T>>): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaTreeItem
			{...rest}
			className={cx(
				[
					"shrink-0 rounded-lg px-2 py-1.5 pe-2",
					"group/tree-item relative flex select-none rounded-lg focus:outline-hidden",
					"focus:bg-(--tree-active-bg) focus:text-(--tree-active-fg) focus:**:[.text-muted-fg]:text-(--tree-active-fg)",
					"**:data-[slot=avatar]:block-6 **:data-[slot=avatar]:inline-6 **:data-[slot=avatar]:*:block-6 **:data-[slot=avatar]:*:inline-6 sm:**:data-[slot=avatar]:block-5 sm:**:data-[slot=avatar]:inline-5 sm:**:data-[slot=avatar]:*:block-5 sm:**:data-[slot=avatar]:*:inline-5",
					"**:data-[slot=icon]:me-1 **:data-[slot=icon]:block-5 **:data-[slot=icon]:inline-5 **:data-[slot=icon]:shrink-0 sm:**:data-[slot=icon]:block-4 sm:**:data-[slot=icon]:inline-4",
					"disabled:opacity-50",
					"href" in props ? "cursor-pointer" : "cursor-default",
				],
				className,
			)}
		/>
	);
}

export interface TreeContentProps extends AriaTreeItemContentProps {
	className?: string;
}

export function TreeContent(props: Readonly<TreeContentProps>): ReactNode {
	const { className, children, ...rest } = props;

	return (
		<AriaTreeItemContent {...rest}>
			{(values) => (
				<div
					className={twMerge(
						"relative flex inline-full min-inline-0 items-center gap-x-1 truncate text-sm/6",
						className,
					)}
				>
					{values.selectionMode === "multiple" && values.selectionBehavior === "toggle" && (
						<Checkbox className="[--indicator-mt:0] sm:[--indicator-mt:0]" slot="selection" />
					)}
					<div
						className={twJoin(
							"relative inline-[calc(calc(var(--tree-item-level)-1)*(--spacing(5)))] shrink-0",
							"before:absolute before:inset-0 before:-ms-1 before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-item-level)-1px),var(--border)_calc(var(--tree-item-level)-1px),var(--border)_calc(var(--tree-item-level)))]",
						)}
					/>
					{values.hasChildItems ? (
						<TreeIndicator
							values={{
								isDisabled: values.isDisabled,
								isExpanded: values.isExpanded,
							}}
						/>
					) : (
						<span aria-hidden={true} className="block inline-5 shrink-0" />
					)}
					{typeof children === "function" ? children(values) : children}
				</div>
			)}
		</AriaTreeItemContent>
	);
}

export interface TreeIndicatorProps {
	values: Pick<AriaTreeItemContentRenderProps, "isDisabled" | "isExpanded">;
}

export function TreeIndicator(props: Readonly<TreeIndicatorProps>): ReactNode {
	const { values } = props;

	return (
		<AriaButton
			className={twJoin(
				"shrink-0 content-center text-muted-fg hover:text-fg",
				values.isExpanded && "text-fg",
			)}
			isDisabled={values.isDisabled}
			slot="chevron"
		>
			<ChevronRightIcon
				className={twJoin(
					"-mx-0.5 block-5 inline-5 transition-transform duration-200 ease-in-out sm:block-4 sm:inline-4",
					values.isExpanded && "rotate-90",
				)}
				data-slot="chevron"
			/>
		</AriaButton>
	);
}
