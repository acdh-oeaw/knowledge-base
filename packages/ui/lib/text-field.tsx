"use client";

import type { ReactNode } from "react";
import {
	TextField as AriaTextField,
	type TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";

import { fieldStyles } from "@/lib/field";
import { cx } from "@/lib/primitive";

export interface TextFieldProps extends AriaTextFieldProps {}

export function TextField(props: Readonly<TextFieldProps>): ReactNode {
	const { className, ...rest } = props;

	return <AriaTextField {...rest} className={cx(fieldStyles(), className)} data-slot="control" />;
}
