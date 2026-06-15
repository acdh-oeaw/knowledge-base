"use client";

import { type ComponentProps, Fragment, type ReactNode } from "react";
import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from "react-aria-components";
import { twJoin, twMerge } from "tailwind-merge";

import { Label } from "@/lib/field";
import { cx } from "@/lib/primitive";

export interface SwitchProps extends AriaSwitchProps {}

export function Switch(props: Readonly<SwitchProps>): ReactNode {
	const { children, className, ...rest } = props;

	return (
		<AriaSwitch
			{...rest}
			className={cx(
				[
					"[--switch-bg-ring:var(--color-blue-700)]/90 [--switch-bg:var(--color-blue-600)] dark:[--switch-bg-ring:transparent]",
					"[--switch-ring:var(--color-blue-700)]/90 [--switch-shadow:var(--color-blue-900)]/20 [--switch:white]",
					// eslint-disable-next-line better-tailwindcss/enforce-consistent-class-order
					"group relative grid cursor-default grid-cols-[1fr_auto] gap-x-6 gap-y-1 disabled:opacity-50 *:data-[slot=indicator]:col-start-2 *:data-[slot=indicator]:self-start *:data-[slot=label]:col-start-1 *:data-[slot=label]:row-start-1 *:[[slot=description]]:col-start-1 *:[[slot=description]]:row-start-2 sm:*:data-[slot=indicator]:mbs-0.5 has-[[slot=description]]:**:data-[slot=label]:font-medium",
				],
				className,
			)}
			data-slot="control"
			style={({ defaultStyle }) => {
				return {
					...defaultStyle,
					WebkitTapHighlightColor: "transparent",
				};
			}}
		>
			{(values) => (
				<Fragment>
					<span
						className={twMerge(
							"relative isolate inline-flex block-6 inline-10 cursor-default rounded-full p-0.75 sm:block-5 sm:inline-8",
							"transition duration-200 ease-in-out",
							"inset-ring inset-ring-input bg-input/30",
							"forced-colors:outline forced-colors:[--switch-bg:Highlight]",
							values.isHovered && "inset-ring-muted-fg/30",
							values.isFocusVisible &&
								"inset-ring-ring/70 bg-ring/20 ring-2 ring-ring/20 selected:inset-ring-ring/30 dark:inset-ring-ring/70",
							values.isSelected &&
								"inset-ring-(--switch-shadow) bg-(--switch-bg) dark:inset-ring-(--switch-bg-ring) dark:bg-(--switch-bg)",
							values.isDisabled &&
								"dark:group-disabled:bg-muted-fg/30 dark:group-disabled:group-selected:inset-ring-muted-fg/30 dark:group-disabled:group-selected:bg-(--switch-bg)",
						)}
						data-slot="indicator"
					>
						<span
							aria-hidden="true"
							className={twJoin(
								"pointer-events-none relative inline-block block-4.5 inline-4.5 translate-x-0 rounded-full border border-transparent bg-white shadow-sm ring ring-fg/5 transition duration-200 ease-in-out sm:block-3.5 sm:inline-3.5",
								values.isSelected &&
									"translate-x-4 bg-(--switch) shadow-(--switch-shadow) ring-(--switch-ring) group-disabled:shadow-sm group-disabled:ring-secondary-fg/5 sm:translate-x-3",
							)}
						/>
					</span>
					{typeof children === "function" ? (
						children(values)
					) : typeof children === "string" ? (
						<SwitchLabel>{children}</SwitchLabel>
					) : (
						children
					)}
				</Fragment>
			)}
		</AriaSwitch>
	);
}

export interface SwitchLabelProps extends ComponentProps<typeof Label> {}

export function SwitchLabel(props: Readonly<SwitchLabelProps>): ReactNode {
	return <Label elementType="span" {...props} />;
}
