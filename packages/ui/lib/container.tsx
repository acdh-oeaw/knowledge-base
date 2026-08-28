import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface ContainerProps extends ComponentProps<"div"> {
	constrained?: boolean;
}

export function Container({
	className,
	constrained = false,
	ref,
	...props
}: Readonly<ContainerProps>): ReactNode {
	return (
		<div
			className={twMerge(
				"mx-auto [--container-breakpoint:var(--breakpoint-xl)] [--container-padding:--spacing(4)] inline-full max-inline-(--container-breakpoint)",
				constrained ? "sm:px-(--container-padding)" : "px-(--container-padding)",
				className,
			)}
			{...props}
			ref={ref}
		/>
	);
}
