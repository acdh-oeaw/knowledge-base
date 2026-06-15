import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface HeadingProps extends React.ComponentProps<
	"h1" | "h2" | "h3" | "h4" | "h5" | "h6"
> {
	level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function Heading({ className, level = 1, ...props }: Readonly<HeadingProps>): ReactNode {
	// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
	const Element: `h${typeof level}` = `h${level}`;

	return (
		<Element
			className={twMerge(
				"text-fg",
				level === 1 && "font-semibold text-xl sm:text-2xl",
				level === 2 && "font-semibold text-lg sm:text-xl",
				level === 3 && "font-semibold text-base sm:text-lg",
				level === 4 && "font-semibold text-base",
				className,
			)}
			{...props}
		/>
	);
}
