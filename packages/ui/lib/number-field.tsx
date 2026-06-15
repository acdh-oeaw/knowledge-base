"use client";

import { MinusIcon, PlusIcon } from "@heroicons/react/20/solid";
import type { ReactNode } from "react";
import {
	Button as AriaButton,
	Group as AriaGroup,
	Input as AriaInput,
	type InputProps as AriaInputProps,
	NumberField as AriaNumberField,
	type NumberFieldProps as AriaNumberFieldProps,
} from "react-aria-components";
import { twJoin } from "tailwind-merge";

import { fieldStyles } from "@/lib/field";
import { cx } from "@/lib/primitive";

export interface NumberFieldProps extends AriaNumberFieldProps {}

export function NumberField(props: Readonly<NumberFieldProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaNumberField
			{...rest}
			className={cx(fieldStyles({ className: "group/number-field" }), className)}
			data-slot="control"
		/>
	);
}

export interface NumberInputProps extends AriaInputProps {}

export function NumberInput({ className, ...props }: Readonly<NumberInputProps>): ReactNode {
	return (
		<AriaGroup
			className={twJoin(
				"flex items-center overflow-hidden rounded-lg border border-input",
				"hover:border-muted-fg/30",
				"focus-within:border-ring/70 focus-within:bg-primary-subtle/5 focus-within:ring-3 focus-within:ring-ring/20 focus-within:hover:border-ring/80",
				"group-invalid/number-field:border-danger-subtle-fg/70 group-invalid/number-field:bg-danger-subtle/5 group-invalid/number-field:hover:border-danger-subtle-fg/80",
				"focus-within:group-invalid/number-field:border-danger-subtle-fg/70 focus-within:group-invalid/number-field:bg-danger-subtle/5 focus-within:group-invalid/number-field:ring-danger-subtle-fg/20 focus-within:group-invalid/number-field:hover:border-danger-subtle-fg/80",
				"group-disabled/number-field:bg-muted group-disabled/number-field:opacity-50",
				"dark:scheme-dark",
			)}
			data-slot="control"
		>
			<AriaButton
				className={twJoin(
					"grid shrink-0 place-content-center border-e border-input",
					"px-3 py-2.5 sm:px-2.5 sm:py-1.5",
					"text-muted-fg pressed:text-fg hover:text-fg",
					"forced-colors:border-[ButtonBorder]",
				)}
				slot="decrement"
			>
				<MinusIcon className="block-5 inline-5 sm:block-4 sm:inline-4" />
			</AriaButton>
			<AriaInput
				{...props}
				className={cx(
					"min-inline-0 flex-1 appearance-none bg-transparent",
					"px-3 py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)]",
					"text-center text-base/6 text-fg placeholder:text-muted-fg sm:text-sm/6",
					"focus:outline-hidden",
					"[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
					className,
				)}
			/>
			<AriaButton
				className={twJoin(
					"grid shrink-0 place-content-center border-s border-input",
					"px-3 py-2.5 sm:px-2.5 sm:py-1.5",
					"text-muted-fg pressed:text-fg hover:text-fg",
					"forced-colors:border-[ButtonBorder]",
				)}
				slot="increment"
			>
				<PlusIcon className="block-5 inline-5 sm:block-4 sm:inline-4" />
			</AriaButton>
		</AriaGroup>
	);
}
