/* eslint-disable @eslint-react/prefer-read-only-props */

"use client";

import cn from "clsx/lite";
import type { ReactNode } from "react";
import { composeRenderProps } from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { Link } from "./link";

export function Text({ className, ...props }: React.ComponentPropsWithoutRef<"p">): ReactNode {
	return (
		<p
			data-slot="text"
			{...props}
			className={twMerge("text-base/6 text-muted-fg sm:text-sm/6", className)}
		/>
	);
}

export function TextLink({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof Link>): ReactNode {
	return (
		<Link
			{...props}
			className={composeRenderProps(className, (className) =>
				cn(
					"text-primary-subtle-fg decoration-primary-subtle-fg/50 hover:underline hover:decoration-primary-subtle-fg has-data-[slot=icon]:inline-flex has-data-[slot=icon]:items-center has-data-[slot=icon]:gap-x-1",
					className,
				),
			)}
		/>
	);
}

export function Strong({
	className,
	...props
}: React.ComponentPropsWithoutRef<"strong">): ReactNode {
	return <strong {...props} className={twMerge("font-medium", className)} />;
}

export function Code({ className, ...props }: React.ComponentPropsWithoutRef<"code">): ReactNode {
	return (
		<code
			{...props}
			className={twMerge(
				"rounded-sm border bg-muted px-0.5 font-medium text-sm sm:text-[0.8125rem]",
				className,
			)}
		/>
	);
}
