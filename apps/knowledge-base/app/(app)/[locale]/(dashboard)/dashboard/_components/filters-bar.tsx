"use client";

import cn from "clsx/lite";
import type { ReactNode } from "react";
import { Group, type GroupProps, Toolbar, type ToolbarProps } from "react-aria-components";

interface AttributesProps extends Omit<ToolbarProps, "className"> {
	className?: string;
}
export function FiltersBar({ className, ...props }: Readonly<AttributesProps>): ReactNode {
	return (
		<div
			className={cn("-mx-(--layout-padding) -mbe-(--layout-padding) border-be bg-muted", className)}
		>
			<Toolbar
				className="flex flex-col justify-between gap-2 p-(--layout-padding) lg:flex-row"
				{...props}
			/>
		</div>
	);
}

export function FiltersLeft(props: Readonly<GroupProps>): ReactNode {
	return <Group {...props} />;
}

interface FiltersRightProps extends GroupProps {
	cols?: number;
}
export function FiltersRight({
	className,
	cols = 3,
	...props
}: Readonly<FiltersRightProps>): ReactNode {
	return (
		<Group
			{...props}
			className={cn(
				"grid inline-full grid-cols-2 gap-2 self-end sm:inline-auto sm:*:data-[slot=select]:min-inline-40 sm:*:data-[slot=select]:max-inline-40",
				cols === 1 && "sm:grid-cols-1",
				cols === 2 && "sm:grid-cols-2",
				cols === 3 && "sm:grid-cols-3",
				className,
			)}
		/>
	);
}
