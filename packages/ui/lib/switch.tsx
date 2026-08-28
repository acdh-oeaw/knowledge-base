"use client";

import { type ComponentProps, Fragment, type ReactNode } from "react";
import {
	type FieldErrorProps,
	SwitchButton,
	type SwitchButtonProps,
	SwitchField,
	type SwitchFieldProps,
} from "react-aria-components";
import { twJoin, twMerge } from "tailwind-merge";

import { Description, FieldError, Label } from "@/lib/field";
import { cx } from "@/lib/primitive";

export interface SwitchProps extends Omit<SwitchFieldProps, "children"> {
	children?: SwitchButtonProps["children"];
	description?: ReactNode;
	errorMessage?: FieldErrorProps["children"];
}

export function Switch(props: Readonly<SwitchProps>): ReactNode {
	const { children, className, description, errorMessage, ...rest } = props;

	return (
		<SwitchField
			{...rest}
			className={cx(
				[
					"[--switch-bg-ring:var(--color-blue-700)]/90 [--switch-bg:var(--color-blue-600)] dark:[--switch-bg-ring:transparent]",
					"[--switch-ring:var(--color-blue-700)]/90 [--switch-shadow:var(--color-blue-900)]/20 [--switch:white]",
					"group grid gap-y-1 disabled:opacity-50 has-[[slot=description]]:**:data-[slot=label]:font-medium",
				],
				className,
			)}
			data-slot="control"
		>
			<SwitchButton
				className="relative grid cursor-default grid-cols-[1fr_auto] gap-x-6 *:data-[slot=indicator]:col-start-2 *:data-[slot=indicator]:self-start *:data-[slot=label]:col-start-1 *:data-[slot=label]:row-start-1 sm:*:data-[slot=indicator]:mbs-0.5"
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
								"relative isolate inline-flex cursor-default rounded-full p-0.75 block-6 inline-10 sm:block-5 sm:inline-8",
								"transition duration-200 ease-in-out",
								"bg-input/30 inset-ring inset-ring-input",
								"forced-colors:outline forced-colors:[--switch-bg:Highlight]",
								values.isHovered && "inset-ring-muted-fg/30",
								values.isFocusVisible &&
									"bg-ring/20 ring-2 ring-ring/20 inset-ring-ring/70 dark:inset-ring-ring/70 selected:inset-ring-ring/30",
								values.isSelected &&
									"bg-(--switch-bg) inset-ring-(--switch-shadow) dark:bg-(--switch-bg) dark:inset-ring-(--switch-bg-ring)",
								values.isDisabled &&
									"dark:group-disabled:bg-muted-fg/30 dark:group-disabled:group-selected:bg-(--switch-bg) dark:group-disabled:group-selected:inset-ring-muted-fg/30",
							)}
							data-slot="indicator"
						>
							<span
								aria-hidden="true"
								className={twJoin(
									"pointer-events-none relative inline-block translate-x-0 rounded-full border border-transparent bg-white shadow-sm ring ring-fg/5 transition duration-200 ease-in-out block-4.5 inline-4.5 sm:block-3.5 sm:inline-3.5",
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
			</SwitchButton>
			{/* Siblings of the button, not children: the button is the `<label>`, so anything nested in it
			    would be folded into the switch's accessible name. */}
			{description == null ? null : <Description>{description}</Description>}
			<FieldError>{errorMessage}</FieldError>
		</SwitchField>
	);
}

export interface SwitchLabelProps extends ComponentProps<typeof Label> {}

export function SwitchLabel(props: Readonly<SwitchLabelProps>): ReactNode {
	return <Label elementType="span" {...props} />;
}
