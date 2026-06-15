"use client";

import type { ReactNode } from "react";
import type { VariantProps } from "tailwind-variants";

import { buttonStyles } from "@/lib/button-styles";
import { Link, type LinkProps } from "@/lib/link";
import { cx } from "@/lib/primitive";

export interface ButtonLinkProps extends LinkProps, VariantProps<typeof buttonStyles> {}

export function ButtonLink({
	className,
	intent,
	size,
	isCircle,
	...props
}: Readonly<ButtonLinkProps>): ReactNode {
	return (
		<Link
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
