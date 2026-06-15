"use client";

import type { ComponentProps, ReactNode } from "react";
import {
	FieldError as FieldErrorPrimitive,
	type FieldErrorProps,
	Label as LabelPrimitive,
	type LabelProps,
	Text,
	type TextProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";
import { tv } from "tailwind-variants";

import { cx } from "@/lib/primitive";

export const labelStyles = tv({
	base: [
		"select-none text-base/6 text-fg in-disabled:opacity-50 group-disabled:opacity-50 sm:text-sm/6",
		"in-data-required:after:content-['*'] in-data-required:after:ms-0.5 in-data-required:after:text-danger",
	],
});

export const descriptionStyles = tv({
	base: "block text-muted-fg text-sm/6 in-disabled:opacity-50 group-disabled:opacity-50",
});

export const fieldErrorStyles = tv({
	base: "block text-danger-subtle-fg text-sm/6 in-disabled:opacity-50 group-disabled:opacity-50 forced-colors:text-[Mark]",
});

export const fieldStyles = tv({
	base: [
		"inline-full",
		"[&>[data-slot=label]+[data-slot=control]]:mbs-2",
		"[&>[data-slot=label]+[data-slot=control]]:mbs-2",
		"[&>[data-slot=label]+[slot='description']]:mbs-1",
		"[&>[slot=description]+[data-slot=control]]:mbs-2",
		"[&>[data-slot=control]+[slot=description]]:mbs-2",
		"[&>[data-slot=control]+[slot=errorMessage]]:mbs-2",
		"*:data-[slot=label]:font-medium",
		"in-disabled:opacity-50 disabled:opacity-50",
	],
});

export function Label({ className, ...props }: Readonly<LabelProps>): ReactNode {
	return <LabelPrimitive data-slot="label" {...props} className={labelStyles({ className })} />;
}

export function Description({ className, ...props }: Readonly<TextProps>): ReactNode {
	return <Text {...props} className={descriptionStyles({ className })} slot="description" />;
}

export function Fieldset({ className, ...props }: Readonly<ComponentProps<"fieldset">>): ReactNode {
	return (
		<fieldset
			className={twMerge("*:data-[slot=text]:mbs-1 [&>*+[data-slot=control]]:mbs-6", className)}
			{...props}
		/>
	);
}

export function FieldGroup({ className, ...props }: Readonly<ComponentProps<"div">>): ReactNode {
	return <div className={twMerge("space-y-6", className)} data-slot="control" {...props} />;
}

export function FieldError({ className, ...props }: Readonly<FieldErrorProps>): ReactNode {
	return <FieldErrorPrimitive {...props} className={cx(fieldErrorStyles(), className)} />;
}

export function Legend({ className, ...props }: Readonly<ComponentProps<"legend">>): ReactNode {
	return (
		<legend
			data-slot="legend"
			{...props}
			className={twMerge("font-semibold text-base/6 data-disabled:opacity-50", className)}
		/>
	);
}
