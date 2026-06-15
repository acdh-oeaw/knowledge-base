import type { ComponentProps, ReactNode } from "react";
import { Keyboard as AriaKeyboard } from "react-aria-components";
import { twMerge } from "tailwind-merge";

export interface KeyboardProps extends ComponentProps<typeof AriaKeyboard> {}

export function Keyboard(props: Readonly<KeyboardProps>): ReactNode {
	const { children, className, ...rest } = props;

	return (
		<AriaKeyboard
			className={twMerge(
				"hidden font-mono text-[0.80rem]/6 text-current/60 group-hover:text-fg group-focus:text-fg group-focus:opacity-90 group-disabled:opacity-50 lg:inline forced-colors:group-focus:text-[HighlightText]",
				className,
			)}
			data-slot="keyboard"
			{...rest}
		>
			{children}
		</AriaKeyboard>
	);
}
