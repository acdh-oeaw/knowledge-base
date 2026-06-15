"use client";

import { XCircleIcon } from "@heroicons/react/16/solid";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";
import {
	Tag as AriaTag,
	TagGroup as AriaTagGroup,
	type TagGroupProps as AriaTagGroupProps,
	TagList as AriaTagList,
	type TagListProps as AriaTagListProps,
	type TagProps as AriaTagProps,
	Button,
	composeRenderProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { cx } from "@/lib/primitive";

export interface TagGroupProps extends AriaTagGroupProps {}

export function TagGroup(props: Readonly<TagGroupProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaTagGroup
			{...rest}
			className={twMerge("flex flex-col gap-y-1 *:data-[slot=label]:font-medium", className)}
			data-slot="control"
		/>
	);
}

export interface TagListProps<T extends object> extends AriaTagListProps<T> {}

export function TagList<T extends object>(props: Readonly<TagListProps<T>>): ReactNode {
	const { className, ...rest } = props;

	return <AriaTagList {...rest} className={cx("flex flex-wrap gap-1", className)} />;
}

export interface TagProps extends AriaTagProps {}

export function Tag(props: Readonly<TagProps>): ReactNode {
	const { children, className, ...rest } = props;

	const t = useExtracted("ui");

	const textValue = typeof children === "string" ? children : undefined;

	return (
		<AriaTag
			{...rest}
			className={cx(
				"inset-ring inset-ring-input outline-hidden dark:bg-input/30",
				"inline-flex items-center gap-x-1.5 py-0.5 font-medium text-xs/5 forced-colors:outline",
				"*:data-[slot=icon]:block-3 *:data-[slot=icon]:inline-3 *:data-[slot=icon]:shrink-0",
				"cursor-default rounded-full px-2",
				"selected:inset-ring-ring/70 selected:bg-primary-subtle selected:text-primary-subtle-fg",
				"disabled:opacity-50 forced-colors:disabled:text-[GrayText]",
				className,
			)}
			textValue={textValue}
		>
			{composeRenderProps(children, (children, renderProps) => {
				const { allowsRemoving } = renderProps;

				return (
					<Fragment>
						{children}
						{allowsRemoving && (
							<Button aria-label={t("Remove tag")} className="" slot="remove">
								<XCircleIcon className="-me-1 block-4 inline-4" />
							</Button>
						)}
					</Fragment>
				);
			})}
		</AriaTag>
	);
}
