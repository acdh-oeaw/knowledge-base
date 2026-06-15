"use client";

import type { ReactNode } from "react";
import {
	Separator as AriaSeparator,
	type SeparatorProps as AriaSeparatorProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

export interface SeparatorProps extends AriaSeparatorProps {}

export function Separator(props: Readonly<SeparatorProps>): ReactNode {
	const { className, orientation = "horizontal", ...rest } = props;

	return (
		<AriaSeparator
			{...rest}
			className={twMerge(
				"shrink-0 bg-border forced-colors:bg-[ButtonBorder]",
				orientation === "horizontal" ? "block-px inline-full" : "block-full inline-px",
				className,
			)}
		/>
	);
}
