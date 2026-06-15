"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./button";

export interface SubmitButtonProps extends Omit<ButtonProps, "isPending"> {
	children: ReactNode;
}

export function SubmitButton(props: Readonly<SubmitButtonProps>): ReactNode {
	const { children, ...rest } = props;

	const { pending: isPending } = useFormStatus();

	return (
		<Button {...rest} isPending={isPending} type="submit">
			{children}
		</Button>
	);
}
