import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface ContainerProps extends React.ComponentProps<"div"> {
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
				"mx-auto inline-full max-inline-(--container-breakpoint) [--container-breakpoint:var(--breakpoint-xl)] [--container-padding:--spacing(4)]",
				constrained ? "sm:px-(--container-padding)" : "px-(--container-padding)",
				className,
			)}
			{...props}
			ref={ref}
		/>
	);
}
