"use client";

import type { ReactNode } from "react";
import {
	Group as AriaGroup,
	type GroupProps as AriaGroupProps,
	Input as AriaInput,
	type InputProps as AriaInputProps,
} from "react-aria-components";

import { cx } from "@/lib/primitive";

interface InputProps extends AriaInputProps {}

export function Input(props: Readonly<InputProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<span className="relative block inline-full" data-slot="control">
			<AriaInput
				className={cx(
					"relative block inline-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]",
					"text-base/6 text-fg placeholder:text-muted-fg sm:text-sm/6",
					"border border-input hover:border-muted-fg/30",
					"focus:border-ring/70 focus:bg-primary-subtle/5 focus:outline-hidden focus:ring-3 focus:ring-ring/20 focus:hover:border-ring/80",
					"invalid:border-danger-subtle-fg/70 invalid:bg-danger-subtle/5 invalid:hover:border-danger-subtle-fg/80 focus:invalid:border-danger-subtle-fg/70 focus:invalid:bg-danger-subtle/5 focus:invalid:ring-danger-subtle-fg/20 focus:invalid:hover:border-danger-subtle-fg/80",
					"[&::-ms-reveal]:hidden [&::-webkit-search-cancel-button]:hidden",
					"disabled:bg-muted disabled:opacity-50",
					"dark:scheme-dark",
					className,
				)}
				{...rest}
			/>
		</span>
	);
}

export interface InputGroupProps extends AriaGroupProps {}

export function InputGroup(props: Readonly<InputGroupProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaGroup
			className={cx(
				"relative isolate block",
				// icon
				"sm:has-[>[data-slot=icon]:last-child]:[&_input]:pe-8 sm:has-[>[data-slot=icon]:first-child]:[&_input]:ps-8 has-[>[data-slot=icon]:last-child]:[&_input]:pe-10 has-[>[data-slot=icon]:first-child]:[&_input]:ps-10",
				"*:data-[slot=icon]:pointer-events-none *:data-[slot=icon]:absolute *:data-[slot=icon]:inset-bs-3 *:data-[slot=icon]:z-10 *:data-[slot=icon]:block-5 *:data-[slot=icon]:inline-5 sm:*:data-[slot=icon]:inset-bs-2.5 sm:*:data-[slot=icon]:block-4 sm:*:data-[slot=icon]:inline-4",
				"sm:[&>[data-slot=icon]:first-child]:inset-s-2.5 sm:[&>[data-slot=icon]:last-child]:inset-e-2.5 [&>[data-slot=icon]:first-child]:inset-s-3 [&>[data-slot=icon]:last-child]:inset-e-3",

				// loader
				"sm:has-[[data-slot=loader]:last-child]:[&_input]:pe-8 sm:has-[[data-slot=loader]:first-child]:[&_input]:ps-8 has-[[data-slot=loader]:last-child]:[&_input]:pe-10 has-[[data-slot=loader]:first-child]:[&_input]:ps-10",
				"*:data-[slot=loader]:pointer-events-none *:data-[slot=loader]:absolute *:data-[slot=loader]:inset-bs-3 *:data-[slot=loader]:z-10 *:data-[slot=loader]:block-5 *:data-[slot=loader]:inline-5 sm:*:data-[slot=loader]:inset-bs-2.5 sm:*:data-[slot=loader]:block-4 sm:*:data-[slot=loader]:inline-4",
				"sm:[&>[data-slot=loader]:first-child]:inset-s-2.5 sm:[&>[data-slot=loader]:last-child]:inset-e-2.5 [&>[data-slot=loader]:first-child]:inset-s-3 [&>[data-slot=loader]:last-child]:inset-e-3",

				// text
				"sm:has-[[data-slot=text]:last-child]:[&_input]:pe-(--input-gutter-end,--spacing(10)) sm:has-[[data-slot=text]:first-child]:[&_input]:ps-(--input-gutter-start,--spacing(10)) has-[[data-slot=text]:last-child]:[&_input]:pe-[calc(var(--input-gutter-end)+(--spacing(2)))] has-[[data-slot=text]:first-child]:[&_input]:ps-[calc(var(--input-gutter-start)+(--spacing(2)))]",
				"*:data-[slot=text]:absolute *:data-[slot=text]:inset-bs-0 *:data-[slot=text]:z-10 *:data-[slot=text]:block-full *:data-[slot=text]:max-inline-fit *:data-[slot=text]:grow *:data-[slot=text]:content-center [&>[data-slot='text']:not([class*='pointer-events'])]:pointer-events-none",
				"sm:[&>[data-slot=text]:first-child:not([class*='left-'])]:inset-s-2.5 sm:[&>[data-slot=text]:last-child:not([class*='right-'])]:inset-e-2.5 [&>[data-slot=text]:first-child:not([class*='left-'])]:inset-s-3 [&>[data-slot=text]:last-child:not([class*='right-'])]:inset-e-3",

				// keyboard
				"sm:has-[[data-slot=keyboard]:last-child]:[&_input]:pe-(--input-gutter-end,--spacing(10)) sm:has-[[data-slot=keyboard]:first-child]:[&_input]:ps-(--input-gutter-start,--spacing(10)) has-[[data-slot=keyboard]:last-child]:[&_input]:pe-[calc(var(--input-gutter-end)+(--spacing(2)))] has-[[data-slot=keyboard]:first-child]:[&_input]:ps-[calc(var(--input-gutter-start)+(--spacing(2)))]",
				"*:data-[slot=keyboard]:absolute *:data-[slot=keyboard]:inset-bs-0 *:data-[slot=keyboard]:z-10 *:data-[slot=keyboard]:block-full *:data-[slot=keyboard]:max-inline-fit *:data-[slot=keyboard]:grow *:data-[slot=keyboard]:content-center [&>[data-slot='keyboard']:not([class*='pointer-events'])]:pointer-events-none",
				"sm:[&>[data-slot=keyboard]:first-child:not([class*='left-'])]:inset-s-2.5 sm:[&>[data-slot=keyboard]:last-child:not([class*='right-'])]:inset-e-2.5 [&>[data-slot=keyboard]:first-child:not([class*='left-'])]:inset-s-3 [&>[data-slot=keyboard]:last-child:not([class*='right-'])]:inset-e-3",

				// button
				"has-invalid:*:[button]:border-danger-subtle-fg/70 has-invalid:*:[button]:outline-danger-subtle-fg/80 has-invalid:*:[button]:ring-danger-subtle-fg/20",
				"sm:has-[>button:last-child]:[&_input]:pe-(--input-gutter-end,--spacing(14)) sm:has-[>button:first-child]:[&_input]:ps-(--input-gutter-start,--spacing(14)) has-[>button:last-child]:[&_input]:pe-(--input-gutter-end,--spacing(16)) has-[>button:first-child]:[&_input]:ps-(--input-gutter-start,--spacing(16))",
				"[&>button:first-child]:rounded-e-none [&>button:last-child]:rounded-s-none",
				// eslint-disable-next-line better-tailwindcss/enforce-consistent-class-order
				"sm:*:[button]:min-block-9 [&>button[data-intent=outline]]:border-input *:[button]:absolute *:[button]:inset-bs-0 *:[button]:z-10 *:[button]:min-block-11",
				"[&>button:first-child]:inset-s-0 [&>button:last-child]:inset-e-0",

				"[&>[data-slot='icon']:not([class*='text-'])]:text-muted-fg [&>[data-slot='loader']:not([class*='text-'])]:text-muted-fg [&>[data-slot='text']:not([class*='text-'])]:text-muted-fg",
				className,
			)}
			data-slot="control"
			{...rest}
		/>
	);
}
