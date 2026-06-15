"use client";

import { CheckIcon, MinusIcon } from "@heroicons/react/20/solid";
import type { ReactNode } from "react";
import {
	CheckboxGroup as CheckboxGroupPrimitive,
	type CheckboxGroupProps,
	Checkbox as CheckboxPrimitive,
	type CheckboxProps,
	composeRenderProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { cx } from "@/lib/primitive";

import { Label } from "./field";

export function CheckboxGroup({ className, ...props }: Readonly<CheckboxGroupProps>): ReactNode {
	return (
		<CheckboxGroupPrimitive
			{...props}
			className={cx(
				"space-y-3 **:[[slot=description]]:block has-[[slot=description]]:space-y-6 has-[[slot=description]]:**:data-[slot=label]:font-medium",
				className,
			)}
			data-slot="control"
		/>
	);
}

export function Checkbox({ className, children, ...props }: Readonly<CheckboxProps>): ReactNode {
	return (
		<CheckboxPrimitive
			className={cx(
				"group block [--indicator-mt:--spacing(0.75)] disabled:opacity-50 sm:[--indicator-mt:--spacing(1)]",
				className,
			)}
			data-slot="control"
			{...props}
		>
			{composeRenderProps(
				children,
				(children, { isSelected, isIndeterminate, isFocusVisible, isInvalid }) => {
					const isStringChild = typeof children === "string";
					const indicator = isIndeterminate ? (
						<MinusIcon data-slot="check-indicator" />
					) : isSelected ? (
						<CheckIcon data-slot="check-indicator" />
					) : null;

					const content = isStringChild ? <CheckboxLabel>{children}</CheckboxLabel> : children;

					return (
						<div
							className={twMerge(
								"grid grid-cols-[1.125rem_1fr] gap-y-1 sm:grid-cols-[1rem_1fr] has-data-[slot=label]:gap-x-3",
								"*:data-[slot=indicator]:col-start-1 *:data-[slot=indicator]:row-start-1 *:data-[slot=indicator]:mbs-(--indicator-mt)",
								"*:data-[slot=label]:col-start-2 *:data-[slot=label]:row-start-1",
								"*:[[slot=description]]:col-start-2 *:[[slot=description]]:row-start-2",
								"has-[[slot=description]]:**:data-[slot=label]:font-medium",
							)}
						>
							<span
								className={twMerge([
									"relative inset-ring inset-ring-input isolate flex shrink-0 items-center justify-center rounded-sm text-bg transition group-hover:inset-ring-muted-fg/30",
									"sm:block-4 sm:inline-4 sm:*:data-[slot=check-indicator]:block-3.5 sm:*:data-[slot=check-indicator]:inline-3.5",
									"block-4.5 inline-4.5 *:data-[slot=check-indicator]:block-4 *:data-[slot=check-indicator]:inline-4",
									"in-disabled:bg-muted",
									(isSelected ?? isIndeterminate) && [
										"inset-ring-(--checkbox-ring,var(--color-ring)) bg-(--checkbox-bg,var(--color-primary)) text-(--checkbox-fg,var(--color-primary-fg))",
										"group-invalid:bg-danger group-invalid:text-danger-fg dark:group-invalid:inset-ring-danger-subtle-fg/70",
									],
									isFocusVisible && [
										"inset-ring-(--checkbox-ring,var(--color-ring)) ring-(--checkbox-ring,var(--color-ring))/20 ring-3",
										"group-invalid:inset-ring-danger-subtle-fg/70 group-invalid:text-danger-fg group-invalid:ring-danger-subtle-fg/20",
									],
									isInvalid &&
										"inset-ring-danger-subtle-fg/70 bg-danger-subtle/5 text-danger-fg ring-danger-subtle-fg/20 group-hover:inset-ring-danger-subtle-fg/70",
								])}
								data-slot="indicator"
							>
								{indicator}
							</span>
							{content}
						</div>
					);
				},
			)}
		</CheckboxPrimitive>
	);
}

export function CheckboxLabel(props: Readonly<React.ComponentProps<typeof Label>>): ReactNode {
	return <Label elementType="span" {...props} />;
}
