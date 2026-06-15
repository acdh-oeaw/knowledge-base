"use client";

import type { ReactNode } from "react";
import {
	TimeField as AriaTimeField,
	type TimeFieldProps as AriaTimeFieldProps,
	type TimeValue as AriaTimeValue,
} from "react-aria-components";

import { fieldStyles } from "@/lib/field";
import { cx } from "@/lib/primitive";

export interface TimeFieldProps<T extends AriaTimeValue> extends AriaTimeFieldProps<T> {}

export function TimeField<T extends AriaTimeValue>(props: Readonly<TimeFieldProps<T>>): ReactNode {
	const { className, ...rest } = props;

	return <AriaTimeField {...rest} className={cx(fieldStyles(), className)} data-slot="control" />;
}
