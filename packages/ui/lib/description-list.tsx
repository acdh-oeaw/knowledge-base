"use client";

import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function DescriptionList({
	className,
	ref,
	...props
}: Readonly<ComponentProps<"dl">>): ReactNode {
	return (
		<dl
			ref={ref}
			className={twMerge(
				"grid grid-cols-1 text-base/6 sm:grid-cols-[min(50%,--spacing(80))_auto] sm:text-sm/6",
				className,
			)}
			{...props}
		/>
	);
}

export function DescriptionTerm({
	className,
	ref,
	...props
}: Readonly<ComponentProps<"dt">>): ReactNode {
	return (
		<dt
			ref={ref}
			className={twMerge(
				"col-start-1 border-bs pbs-3 text-muted-fg max-inline-3xl first:border-none sm:py-3",
				className,
			)}
			{...props}
		/>
	);
}

export function DescriptionDetails({
	className,
	...props
}: Readonly<ComponentProps<"dd">>): ReactNode {
	return (
		<dd
			{...props}
			className={twMerge(
				"pbs-1 pbe-3 text-fg max-inline-3xl sm:border-bs sm:py-3 sm:nth-2:border-none",
				className,
			)}
			data-slot="description-details"
		/>
	);
}
