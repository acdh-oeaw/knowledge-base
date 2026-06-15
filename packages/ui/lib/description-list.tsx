"use client";

import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function DescriptionList({
	className,
	ref,
	...props
}: Readonly<React.ComponentProps<"dl">>): ReactNode {
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
}: Readonly<React.ComponentProps<"dt">>): ReactNode {
	return (
		<dt
			ref={ref}
			className={twMerge(
				"col-start-1 border-bs pbs-3 max-inline-3xl text-muted-fg first:border-none sm:py-3",
				className,
			)}
			{...props}
		/>
	);
}

export function DescriptionDetails({
	className,
	...props
}: Readonly<React.ComponentProps<"dd">>): ReactNode {
	return (
		<dd
			{...props}
			className={twMerge(
				"pbs-1 pbe-3 max-inline-3xl text-fg sm:border-bs sm:py-3 sm:nth-2:border-none",
				className,
			)}
			data-slot="description-details"
		/>
	);
}
