"use client";

import type { ReactNode } from "react";
import {
	TextArea as AriaTextArea,
	type TextAreaProps as AriaTextAreaProps,
} from "react-aria-components";
import { twJoin } from "tailwind-merge";

import { cx } from "@/lib/primitive";

export interface TextAreaProps extends AriaTextAreaProps {}

export function TextArea(props: Readonly<TextAreaProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<span className="relative block inline-full" data-slot="control">
			<AriaTextArea
				{...rest}
				className={cx(
					twJoin([
						"field-sizing-content relative block min-block-16 inline-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]",
						"text-base/6 text-fg placeholder:text-muted-fg sm:text-sm/6",
						"border border-input hover:border-muted-fg/30",
						"focus:border-ring/70 focus:bg-primary-subtle/5 focus:outline-hidden focus:ring-3 focus:ring-ring/20",
						"invalid:border-danger-subtle-fg/70 invalid:bg-danger-subtle/5 invalid:hover:border-danger-subtle-fg/80 invalid:data-hover:border-danger-subtle-fg/70 focus:invalid:border-danger-subtle-fg/70 focus:invalid:bg-danger-subtle/5 focus:invalid:ring-danger-subtle-fg/20",
						"disabled:bg-muted disabled:opacity-50",
						"dark:scheme-dark",
					]),
					className,
				)}
			/>
		</span>
	);
}
