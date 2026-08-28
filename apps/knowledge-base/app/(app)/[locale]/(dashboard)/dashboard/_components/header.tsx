import { CardDescription, CardHeader } from "@dariah-eric/ui/card";
import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function Header({ className, ...props }: Readonly<ComponentProps<"div">>): ReactNode {
	return (
		<div className={twMerge("-m-(--layout-padding) bg-muted", className)}>
			<div
				className="flex flex-col items-start justify-between gap-4 border-be p-(--layout-padding) min-inline-0 **:data-[slot=card-header]:max-inline-lg md:flex-row md:items-end"
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
			className={twMerge("text-lg leading-none font-semibold tracking-tight", className)}
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
