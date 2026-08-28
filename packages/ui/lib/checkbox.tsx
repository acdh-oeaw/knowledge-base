"use client";

import { CheckIcon, MinusIcon } from "@heroicons/react/20/solid";
import type { ComponentProps, ReactNode } from "react";
import {
	CheckboxButton,
	type CheckboxButtonProps,
	CheckboxField,
	type CheckboxFieldProps,
	CheckboxGroup as CheckboxGroupPrimitive,
	type CheckboxGroupProps,
	type FieldErrorProps,
	composeRenderProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { cx } from "@/lib/primitive";

import { Description, FieldError, Label } from "./field";

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

export interface CheckboxProps extends Omit<CheckboxFieldProps, "children"> {
	children?: CheckboxButtonProps["children"];
	description?: ReactNode;
	errorMessage?: FieldErrorProps["children"];
}

export function Checkbox({
	className,
	children,
	description,
	errorMessage,
	...props
}: Readonly<CheckboxProps>): ReactNode {
	return (
		<CheckboxField
			className={cx(
				"group grid gap-y-1 [--indicator-mt:--spacing(0.75)] disabled:opacity-50 sm:[--indicator-mt:--spacing(1)]",
				"has-[[slot=description]]:**:data-[slot=label]:font-medium",
				className,
			)}
			data-slot="control"
			{...props}
		>
			<CheckboxButton
				className={twMerge(
					"grid grid-cols-[1.125rem_1fr] sm:grid-cols-[1rem_1fr] has-data-[slot=label]:gap-x-3",
					"*:data-[slot=indicator]:col-start-1 *:data-[slot=indicator]:row-start-1 *:data-[slot=indicator]:mbs-(--indicator-mt)",
					"*:data-[slot=label]:col-start-2 *:data-[slot=label]:row-start-1",
				)}
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
							<>
								<span
									className={twMerge([
										"relative isolate flex shrink-0 items-center justify-center rounded-sm text-bg inset-ring inset-ring-input transition group-hover:inset-ring-muted-fg/30",
										"sm:block-4 sm:inline-4 sm:*:data-[slot=check-indicator]:block-3.5 sm:*:data-[slot=check-indicator]:inline-3.5",
										"block-4.5 inline-4.5 *:data-[slot=check-indicator]:block-4 *:data-[slot=check-indicator]:inline-4",
										"in-disabled:bg-muted",
										(isSelected ?? isIndeterminate) && [
											"bg-(--checkbox-bg,var(--color-primary)) text-(--checkbox-fg,var(--color-primary-fg)) inset-ring-(--checkbox-ring,var(--color-ring))",
											"group-invalid:bg-danger group-invalid:text-danger-fg dark:group-invalid:inset-ring-danger-subtle-fg/70",
										],
										isFocusVisible && [
											"ring-3 ring-(--checkbox-ring,var(--color-ring))/20 inset-ring-(--checkbox-ring,var(--color-ring))",
											"group-invalid:text-danger-fg group-invalid:ring-danger-subtle-fg/20 group-invalid:inset-ring-danger-subtle-fg/70",
										],
										isInvalid &&
											"bg-danger-subtle/5 text-danger-fg ring-danger-subtle-fg/20 inset-ring-danger-subtle-fg/70 group-hover:inset-ring-danger-subtle-fg/70",
									])}
									data-slot="indicator"
								>
									{indicator}
								</span>
								{content}
							</>
						);
					},
				)}
			</CheckboxButton>
			{/* Siblings of the button, not children: the button is the `<label>`, so anything nested in it
			    would be folded into the checkbox's accessible name. Indent matches indicator + gap. */}
			{description == null ? null : (
				<Description className="ms-7.5 sm:ms-7">{description}</Description>
			)}
			<FieldError className="ms-7.5 sm:ms-7">{errorMessage}</FieldError>
		</CheckboxField>
	);
}

export function CheckboxLabel(props: Readonly<ComponentProps<typeof Label>>): ReactNode {
	return <Label elementType="span" {...props} />;
}
