import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function Card({
	className,
	...props
}: Readonly<React.HTMLAttributes<HTMLDivElement>>): ReactNode {
	return (
		<div
			className={twMerge(
				"group/card flex flex-col gap-(--gutter) rounded-lg border py-(--gutter) text-fg shadow-xs [--gutter:--spacing(6)] **:data-[slot=table-header]:bg-muted/50 **:[table]:overflow-hidden has-[table]:overflow-hidden has-[table]:**:data-[slot=card-footer]:border-bs has-[table]:not-has-data-[slot=card-footer]:pbe-0",
				className,
			)}
			data-slot="card"
			{...props}
		/>
	);
}

export interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
	title?: string;
	description?: string;
}

export function CardHeader({
	className,
	title,
	description,
	children,
	...props
}: Readonly<HeaderProps>): ReactNode {
	return (
		<div
			className={twMerge(
				"grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-(--gutter) has-data-[slot=card-action]:grid-cols-[1fr_auto]",
				className,
			)}
			data-slot="card-header"
			{...props}
		>
			{title != null ? <CardTitle>{title}</CardTitle> : null}
			{description != null ? <CardDescription>{description}</CardDescription> : null}
			{title == null && typeof children === "string" ? <CardTitle>{children}</CardTitle> : children}
		</div>
	);
}

export function CardTitle({
	className,
	...props
}: Readonly<React.ComponentProps<"div">>): ReactNode {
	return (
		<div
			className={twMerge("text-balance font-semibold text-base/6", className)}
			data-slot="card-title"
			{...props}
		/>
	);
}

export function CardDescription({
	className,
	...props
}: Readonly<React.HTMLAttributes<HTMLDivElement>>): ReactNode {
	return (
		<div
			className={twMerge("row-start-2 text-pretty text-muted-fg text-sm/6", className)}
			data-slot="card-description"
			{...props}
		/>
	);
}

export function CardAction({
	className,
	...props
}: Readonly<React.HTMLAttributes<HTMLDivElement>>): ReactNode {
	return (
		<div
			className={twMerge(
				"col-start-2 row-span-2 row-start-1 self-start justify-self-end",
				className,
			)}
			data-slot="card-action"
			{...props}
		/>
	);
}

export function CardContent({
	className,
	...props
}: Readonly<React.HTMLAttributes<HTMLDivElement>>): ReactNode {
	return (
		<div
			className={twMerge("px-(--gutter) has-[table]:border-bs", className)}
			data-slot="card-content"
			{...props}
		/>
	);
}

export function CardFooter({
	className,
	...props
}: Readonly<React.HTMLAttributes<HTMLDivElement>>): ReactNode {
	return (
		<div
			className={twMerge(
				"flex items-center px-(--gutter) group-has-[table]/card:pbs-(--gutter) [.border-t]:pbs-6",
				className,
			)}
			data-slot="card-footer"
			{...props}
		/>
	);
}
