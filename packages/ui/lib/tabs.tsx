"use client";

import { Fragment, type ReactNode, type RefObject, use } from "react";
import {
	SelectionIndicator,
	TabList as TabListPrimitive,
	type TabListProps as TabListPrimitiveProps,
	type TabPanelProps as TabPanelAriaProps,
	TabPanel as TabPanelPrimitive,
	Tab as TabPrimitive,
	type TabProps as TabPrimitiveProps,
	TabsContext,
	Tabs as TabsPrimitive,
	type TabsProps as TabsPrimitiveProps,
	composeRenderProps,
	useSlottedContext,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { cx } from "@/lib/primitive";

import { UiContext } from "./ui-provider";

export interface TabsProps extends TabsPrimitiveProps {
	ref?: React.RefObject<HTMLDivElement>;
}

export function Tabs(props: Readonly<TabsProps>): ReactNode {
	const { className, ref, orientation = "horizontal", ...rest } = props;

	return (
		<TabsContext value={{ orientation }}>
			<TabsPrimitive
				{...rest}
				ref={ref}
				className={cx(
					orientation === "vertical" ? "inline-full flex-row" : "flex-col",
					"group/tabs flex gap-4 forced-color-adjust-none",
					className,
				)}
				orientation={orientation}
			/>
		</TabsContext>
	);
}

export interface TabListProps<T extends object> extends TabListPrimitiveProps<T> {
	ref?: React.RefObject<HTMLDivElement>;
}

export function TabList<T extends object>(props: Readonly<TabListProps<T>>): ReactNode {
	const { className, ref, ...rest } = props;

	return (
		<TabListPrimitive
			{...rest}
			ref={ref}
			className={composeRenderProps(className, (className, { orientation }) =>
				twMerge([
					"[--tab-list-gutter:--spacing(1)]",
					"relative flex forced-color-adjust-none",
					orientation === "horizontal" &&
						"flex-row gap-x-(--tab-list-gutter) rounded-(--tab-list-rounded) border-be py-(--tab-list-gutter)",
					orientation === "vertical" &&
						"min-inline-56 shrink-0 flex-col items-start gap-y-(--tab-list-gutter) border-s px-(--tab-list-gutter) [--tab-list-gutter:--spacing(2)]",
					className,
				]),
			)}
			data-slot="tab-list"
		/>
	);
}

export interface TabProps extends TabPrimitiveProps {
	ref?: RefObject<HTMLDivElement>;
}

export function Tab(props: Readonly<TabProps>): ReactNode {
	const { children, className, ref, render, ...rest } = props;

	const { LinkComponent = "a" } = use(UiContext);

	const { orientation } = useSlottedContext(TabsContext)!;
	return (
		<TabPrimitive
			{...rest}
			ref={ref}
			className={cx(
				"group/tab rounded-lg [--tab-gutter:var(--tab-gutter-x)]",
				orientation === "horizontal"
					? "[--tab-gutter-x:--spacing(2.5)] [--tab-gutter-y:--spacing(1)] first:-ms-(--tab-gutter) last:-me-(--tab-gutter)"
					: "inline-full justify-start [--tab-gutter-x:--spacing(4)] [--tab-gutter-y:--spacing(1.5)]",
				"relative isolate flex cursor-default items-center whitespace-nowrap font-medium text-sm/6 outline-hidden transition",
				"px-(--tab-gutter-x) py-(--tab-gutter-y)",
				"*:data-[slot=icon]:me-2 *:data-[slot=icon]:-ms-0.5 *:data-[slot=icon]:block-4 *:data-[slot=icon]:inline-4 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:self-center *:data-[slot=icon]:text-muted-fg selected:*:data-[slot=icon]:text-primary-subtle-fg",
				"text-muted-fg selected:text-primary-subtle-fg selected:hover:bg-primary-subtle selected:hover:text-primary-subtle-fg hover:bg-secondary hover:text-fg focus:ring-0",
				"disabled:opacity-50",
				"href" in props ? "cursor-pointer" : "cursor-default",
				className,
			)}
			data-slot="tab"
			render={(domProps, renderProps) => {
				if (render != null) {
					return render(domProps, renderProps);
				}

				if ("href" in domProps && domProps.href && !renderProps.isDisabled) {
					return <LinkComponent {...domProps} />;
				}

				return (
					<div
						{...domProps}
						// @ts-expect-error -- Link may be disabled but have `href`.
						href={undefined}
					/>
				);
			}}
		>
			{(values) => (
				<Fragment>
					{typeof children === "function" ? children(values) : children}
					<SelectionIndicator
						className={twMerge(
							"absolute bg-primary-subtle-fg transition-[translate,width,height] duration-200",
							orientation === "horizontal"
								? "inset-x-(--tab-gutter-x) -inset-be-[calc(var(--tab-gutter-y)+1px)] block-[2px]"
								: "inset-y-(--tab-gutter-y) -inset-s-[calc(var(--tab-gutter-x)-var(--tab-list-gutter)+1px)] inline-[2px]",
						)}
						data-slot="selected-indicator"
					/>
				</Fragment>
			)}
		</TabPrimitive>
	);
}

export interface TabPanelProps extends TabPanelAriaProps {
	ref?: RefObject<HTMLDivElement>;
	shouldPreserveState?: boolean;
}

export function TabPanel(props: Readonly<TabPanelProps>): ReactNode {
	const {
		children,
		className,
		id,
		ref,
		shouldForceMount,
		shouldPreserveState = false,
		...rest
	} = props;

	return (
		<TabPanelPrimitive
			{...rest}
			id={id}
			ref={ref}
			className={cx(
				"flex-1 text-fg text-sm/6 focus-visible:outline-hidden",
				// When state is preserved the inactive panel stays mounted (so its in-progress, uncontrolled
				// form fields keep their values across tab switches) but must be hidden visually. Hide it
				// with CSS `display: none` (react-aria marks inactive panels with `data-inert`) rather than
				// unmounting it or wrapping it in React's `<Activity mode="hidden">` — both of which would
				// tear down the subtree's effects. CSS hiding keeps the DOM state and the panel's live
				// effects intact.
				"data-inert:hidden",
				className,
			)}
			data-slot="tab-panel"
			shouldForceMount={shouldPreserveState ? true : shouldForceMount}
		>
			{children}
		</TabPanelPrimitive>
	);
}
