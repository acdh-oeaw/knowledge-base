"use client";

import type { ComponentProps, ReactNode } from "react";
import {
	OverlayArrow as AriaOverlayArrow,
	Tooltip as AriaTooltip,
	type TooltipProps as AriaTooltipProps,
	TooltipTrigger as AriaTooltipTrigger,
	composeRenderProps,
} from "react-aria-components";
import { twJoin } from "tailwind-merge";
import { type VariantProps, tv } from "tailwind-variants";

export const tooltipStyles = tv({
	base: [
		"group max-inline-sm origin-(--trigger-anchor-point) rounded-lg border border-(--tooltip-border) px-2.5 py-1.5 text-sm/6 will-change-transform [--tooltip-border:var(--color-muted-fg)]/30 dark:shadow-none *:[strong]:font-medium",
	],
	variants: {
		inverse: {
			true: ["border-transparent bg-fg text-bg", "**:[.text-muted-fg]:text-bg/60"],
			false: "bg-overlay text-overlay-fg",
		},
		isEntering: {
			true: [
				"fade-in animate-in",
				"placement-left:slide-in-from-right-1 placement-right:slide-in-from-left-1 placement-top:slide-in-from-bottom-1 placement-bottom:slide-in-from-top-1",
			],
		},
		isExiting: {
			true: [
				"fade-in direction-reverse animate-in",
				"placement-left:slide-out-to-right-1 placement-right:slide-out-to-left-1 placement-top:slide-out-to-bottom-1 placement-bottom:slide-out-to-top-1",
			],
		},
	},
	defaultVariants: {
		inverse: false,
	},
});

export type TooltipProps = ComponentProps<typeof AriaTooltipTrigger>;

export { AriaTooltipTrigger as Tooltip };

export interface TooltipContentProps
	extends Omit<AriaTooltipProps, "children">, VariantProps<typeof tooltipStyles> {
	arrow?: boolean;
	children?: ReactNode;
}

export function TooltipContent(props: Readonly<TooltipContentProps>): ReactNode {
	const { arrow = true, children, className, inverse, offset = 10, ...rest } = props;

	return (
		<AriaTooltip
			{...rest}
			className={composeRenderProps(className, (className, renderProps) =>
				tooltipStyles({
					...renderProps,
					inverse,
					className,
				}),
			)}
			offset={offset}
		>
			{arrow ? (
				<AriaOverlayArrow className="group">
					<svg
						className={twJoin(
							"block group-placement-bottom:rotate-180 group-placement-left:-rotate-90 group-placement-right:rotate-90 forced-colors:fill-[Canvas] forced-colors:stroke-[ButtonBorder]",
							inverse === true
								? "fill-fg stroke-transparent"
								: "fill-overlay stroke-(--tooltip-border)",
						)}
						height={12}
						viewBox="0 0 12 12"
						width={12}
					>
						<path d="M0 0 L6 6 L12 0" />
					</svg>
				</AriaOverlayArrow>
			) : null}
			{children}
		</AriaTooltip>
	);
}
