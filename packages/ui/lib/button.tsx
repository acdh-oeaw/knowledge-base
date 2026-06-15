"use client";

import type { ReactNode } from "react";
import {
	Button as ButtonPrimitive,
	type ButtonProps as ButtonPrimitiveProps,
} from "react-aria-components";
import type { VariantProps } from "tailwind-variants";

import { buttonStyles } from "@/lib/button-styles";
import { cx } from "@/lib/primitive";

export { buttonStyles };

export interface ButtonProps extends ButtonPrimitiveProps, VariantProps<typeof buttonStyles> {
	ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
	className,
	intent,
	size,
	isCircle,
	ref,
	...props
}: Readonly<ButtonProps>): ReactNode {
	return (
		<ButtonPrimitive
			ref={ref}
			{...props}
			className={cx(
				buttonStyles({
					intent,
					size,
					isCircle,
				}),
				className,
			)}
		/>
	);
}
