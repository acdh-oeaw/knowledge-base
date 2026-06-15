"use client";

import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import type { DateDuration } from "@internationalized/date";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";
import {
	Button,
	DatePicker as DatePickerPrimitive,
	type DatePickerProps as DatePickerPrimitiveProps,
	type DateValue,
	type GroupProps,
	type PopoverProps,
} from "react-aria-components";
import { twJoin } from "tailwind-merge";

import { DateInput } from "@/lib/date-field";
import { fieldStyles } from "@/lib/field";
import { InputGroup } from "@/lib/input";
import { cx } from "@/lib/primitive";
import { useIsMobile } from "@/lib/use-mobile";

import { Calendar } from "./calendar";
import { ModalContent } from "./modal";
import { PopoverContent } from "./popover";
import { RangeCalendar } from "./range-calendar";

export interface DatePickerProps<T extends DateValue> extends DatePickerPrimitiveProps<T> {
	popover?: Omit<PopoverProps, "children">;
}

export function DatePicker<T extends DateValue>({
	className,
	children,
	popover,
	...props
}: Readonly<DatePickerProps<T>>): ReactNode {
	return (
		<DatePickerPrimitive className={cx(fieldStyles(), className)} data-slot="control" {...props}>
			{(values) => (
				<Fragment>
					{typeof children === "function" ? children(values) : children}
					<DatePickerOverlay {...popover} />
				</Fragment>
			)}
		</DatePickerPrimitive>
	);
}

export interface DatePickerOverlayProps extends Omit<PopoverProps, "children"> {
	range?: boolean;
	visibleDuration?: DateDuration;
	pageBehavior?: "visible" | "single";
}

export function DatePickerOverlay({
	visibleDuration = { months: 1 },
	pageBehavior = "visible",
	placement = "bottom",
	range,
	...props
}: Readonly<DatePickerOverlayProps>): ReactNode {
	const t = useExtracted("ui");
	const isMobile = useIsMobile();

	return isMobile ? (
		<ModalContent aria-label={t("Date picker")} closeButton={false}>
			<div className="flex justify-center p-6">
				{range != null ? (
					<RangeCalendar pageBehavior={pageBehavior} visibleDuration={visibleDuration} />
				) : (
					<Calendar />
				)}
			</div>
		</ModalContent>
	) : (
		<PopoverContent
			arrow={false}
			className={twJoin(
				"flex min-inline-auto max-inline-none snap-x justify-center p-4 sm:min-inline-66 sm:p-2 sm:pbs-3",
				visibleDuration.months === 1 ? "sm:max-inline-2xs" : "sm:max-inline-none",
			)}
			placement={placement}
			{...props}
		>
			{range != null ? (
				<RangeCalendar pageBehavior={pageBehavior} visibleDuration={visibleDuration} />
			) : (
				<Calendar />
			)}
		</PopoverContent>
	);
}

export function DatePickerTrigger({ className, ...props }: Readonly<GroupProps>): ReactNode {
	const t = useExtracted("ui");

	return (
		<InputGroup className={cx("*:data-[slot=control]:inline-full", className)} {...props}>
			<DateInput />
			<Button
				aria-label={t("Open calendar")}
				className={twJoin(
					"touch-area grid place-content-center outline-hidden",
					"text-muted-fg pressed:text-fg hover:text-fg focus-visible:text-fg",
					"px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6",
					"*:data-[slot=icon]:block-4.5 *:data-[slot=icon]:inline-4.5 sm:*:data-[slot=icon]:block-4 sm:*:data-[slot=icon]:inline-4",
				)}
				data-slot="date-picker-trigger"
			>
				<CalendarDaysIcon />
			</Button>
		</InputGroup>
	);
}
