"use client";

import { Fragment, type ReactNode } from "react";
import {
	DialogTrigger as DialogTriggerPrimitive,
	type DialogTriggerProps,
	OverlayArrow,
	Popover as PopoverPrimitive,
	type PopoverProps as PopoverPrimitiveProps,
} from "react-aria-components";

import {
	DialogBody,
	DialogClose,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/lib/dialog";
import { cx } from "@/lib/primitive";

export type PopoverProps = DialogTriggerProps;

export function Popover(props: Readonly<PopoverProps>): ReactNode {
	return <DialogTriggerPrimitive {...props} />;
}

export const PopoverTitle = DialogTitle;
export const PopoverHeader = DialogHeader;
export const PopoverBody = DialogBody;
export const PopoverFooter = DialogFooter;

export interface PopoverContentProps extends PopoverPrimitiveProps {
	arrow?: boolean;
}

export function PopoverContent(props: Readonly<PopoverContentProps>): ReactNode {
	const { children, arrow = false, className, ...rest } = props;

	// eslint-disable-next-line @eslint-react/prefer-destructuring-assignment
	const offset = props.offset ?? (arrow ? 12 : 8);

	return (
		<PopoverPrimitive
			className={cx(
				"group/popover min-inline-(--trigger-width) max-inline-xs origin-(--trigger-anchor-point) rounded-(--popover-radius) border border-fg/10 bg-overlay text-overlay-fg shadow-xs outline-hidden transition-transform [--gutter:--spacing(6)] [--popover-radius:var(--radius-xl)] sm:text-sm dark:backdrop-saturate-200 **:[[role=dialog]]:[--gutter:--spacing(4)]",
				"entering:fade-in entering:animate-in",
				"exiting:fade-out exiting:animate-out",
				"placement-left:entering:slide-in-from-right-1 placement-right:entering:slide-in-from-left-1 placement-top:entering:slide-in-from-bottom-1 placement-bottom:entering:slide-in-from-top-1",
				"placement-left:exiting:slide-out-to-right-1 placement-right:exiting:slide-out-to-left-1 placement-top:exiting:slide-out-to-bottom-1 placement-bottom:exiting:slide-out-to-top-1",
				"forced-colors:bg-[Canvas]",
				className,
			)}
			offset={offset}
			{...rest}
		>
			{(values) => (
				<Fragment>
					{arrow && (
						<OverlayArrow className="group">
							<svg
								className="block fill-overlay stroke-border group-placement-bottom:rotate-180 group-placement-left:-rotate-90 group-placement-right:rotate-90 forced-colors:fill-[Canvas] forced-colors:stroke-[ButtonBorder]"
								height={12}
								viewBox="0 0 12 12"
								width={12}
							>
								<path d="M0 0 L6 6 L12 0" />
							</svg>
						</OverlayArrow>
					)}
					{typeof children === "function" ? children(values) : children}
				</Fragment>
			)}
		</PopoverPrimitive>
	);
}

export const PopoverTrigger = DialogTrigger;
export const PopoverClose = DialogClose;
export const PopoverDescription = DialogDescription;
