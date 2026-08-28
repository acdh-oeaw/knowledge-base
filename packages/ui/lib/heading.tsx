import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface HeadingProps extends ComponentProps<"h1" | "h2" | "h3" | "h4" | "h5" | "h6"> {
	level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function Heading({ className, level = 1, ...props }: Readonly<HeadingProps>): ReactNode {
	// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
	const Element: `h${typeof level}` = `h${level}`;

	return (
		<Element
			className={twMerge(
				"text-fg",
				level === 1 && "text-xl font-semibold sm:text-2xl",
				level === 2 && "text-lg font-semibold sm:text-xl",
				level === 3 && "text-base font-semibold sm:text-lg",
				level === 4 && "text-base font-semibold",
				className,
			)}
			{...props}
		/>
	);
}
