import { CardDescription, CardHeader } from "@dariah-eric/ui/card";
import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function Header({ className, ...props }: Readonly<ComponentProps<"div">>): ReactNode {
	return (
		<div className={twMerge("-m-(--layout-padding) bg-muted", className)}>
			<div
				className="flex min-inline-0 flex-col items-start justify-between gap-4 border-be p-(--layout-padding) md:flex-row md:items-end **:data-[slot=card-header]:max-inline-lg"
				{...props}
			/>
		</div>
	);
}

export const HeaderContent = CardHeader;
export const HeaderDescription = CardDescription;

export function HeaderTitle({
	className,
	children,
	...props
}: Readonly<ComponentProps<"div">>): ReactNode {
	return (
		<h1
			className={twMerge("font-semibold text-lg leading-none tracking-tight", className)}
			data-slot="section-card-title"
			{...props}
		>
			{children}
		</h1>
	);
}

export function HeaderAction({ className, ...props }: Readonly<ComponentProps<"div">>): ReactNode {
	return (
		<div className={twMerge("flex items-center justify-end gap-x-1.5", className)} {...props} />
	);
}
