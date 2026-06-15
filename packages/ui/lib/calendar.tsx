"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { type CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useExtracted } from "next-intl";
import { type ReactNode, use } from "react";
import { useDateFormatter } from "react-aria";
import {
	CalendarCell,
	CalendarGrid,
	CalendarGridBody,
	CalendarGridHeader as CalendarGridHeaderPrimitive,
	CalendarHeaderCell,
	Calendar as CalendarPrimitive,
	type CalendarProps as CalendarPrimitiveProps,
	type CalendarState,
	CalendarStateContext,
	type DateValue,
	Heading,
	composeRenderProps,
	useLocale,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { Button } from "./button";
import { Select, SelectContent, SelectItem, SelectLabel, SelectTrigger } from "./select";

export interface CalendarProps<T extends DateValue> extends Omit<
	CalendarPrimitiveProps<T>,
	"visibleDuration"
> {
	className?: string;
}

export function Calendar<T extends DateValue>({
	className,
	...props
}: Readonly<CalendarProps<T>>): ReactNode {
	const now = today(getLocalTimeZone());

	return (
		<CalendarPrimitive data-slot="calendar" {...props}>
			<CalendarHeader isRange={false} />
			<CalendarGrid>
				<CalendarGridHeader />
				<CalendarGridBody>
					{(date) => (
						<CalendarCell
							className={composeRenderProps(className, (className, { isSelected, isDisabled }) =>
								twMerge(
									"relative flex block-11 inline-11 cursor-default items-center justify-center rounded-lg text-fg tabular-nums outline-hidden hover:bg-secondary-fg/15 sm:block-9 sm:inline-9 sm:text-sm/6 forced-colors:text-[ButtonText] forced-colors:outline-0",
									isSelected &&
										"bg-primary text-primary-fg pressed:bg-primary hover:bg-primary/90 data-invalid:bg-danger data-invalid:text-danger-fg forced-colors:bg-[Highlight] forced-colors:text-[Highlight] forced-colors:data-invalid:bg-[Mark]",
									isDisabled && "text-muted-fg forced-colors:text-[GrayText]",
									date.compare(now) === 0 &&
										"after:pointer-events-none after:absolute after:inset-s-1/2 after:inset-be-1 after:z-10 after:block-[3px] after:inline-[3px] after:-translate-x-1/2 after:rounded-full after:bg-primary selected:after:bg-primary-fg focus-visible:after:bg-primary-fg",
									className,
								),
							)}
							date={date}
						/>
					)}
				</CalendarGridBody>
			</CalendarGrid>
		</CalendarPrimitive>
	);
}

export function CalendarHeader({
	isRange,
	className,
	...props
}: Readonly<React.ComponentProps<"header"> & { isRange?: boolean }>): ReactNode {
	const t = useExtracted("ui");
	const { direction } = useLocale();
	const state = use(CalendarStateContext)!;

	return (
		<header
			className={twMerge(
				"flex inline-full justify-between gap-1.5 pbs-1 pe-1 pbe-5 ps-1.5 sm:pbe-4",
				className,
			)}
			data-slot="calendar-header"
			{...props}
		>
			{isRange === false && (
				<div className="flex items-center gap-1.5">
					<SelectMonth state={state} />
					<SelectYear state={state} />
				</div>
			)}
			<Heading
				className={twMerge(
					"me-2 flex-1 text-start font-medium text-muted-fg sm:text-sm",
					isRange === false && "sr-only",
					className,
				)}
			/>
			<div className="flex items-center gap-1">
				<Button
					aria-label={t("Previous month")}
					className="block-8 inline-8 sm:block-7 sm:inline-7 **:data-[slot=icon]:text-fg"
					intent="plain"
					isCircle={true}
					size="sq-sm"
					slot="previous"
				>
					{direction === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />}
				</Button>
				<Button
					aria-label={t("Next month")}
					className="block-8 inline-8 sm:block-7 sm:inline-7 **:data-[slot=icon]:text-fg"
					intent="plain"
					isCircle={true}
					size="sq-sm"
					slot="next"
				>
					{direction === "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
				</Button>
			</div>
		</header>
	);
}

export function SelectMonth({ state }: Readonly<{ state: CalendarState }>): ReactNode {
	const months = [];

	const t = useExtracted("ui");

	const formatter = useDateFormatter({
		month: "long",
		timeZone: state.timeZone,
	});

	const numMonths = state.focusedDate.calendar.getMonthsInYear(state.focusedDate);
	for (let i = 1; i <= numMonths; i++) {
		const date = state.focusedDate.set({ month: i });
		months.push(formatter.format(date.toDate(state.timeZone)));
	}
	return (
		<Select
			aria-label={t("Select month")}
			className="[popover-width:8rem]"
			onChange={(value) => {
				state.setFocusedDate(state.focusedDate.set({ month: Number(value) }));
			}}
			value={state.focusedDate.month.toString()}
		>
			<SelectTrigger className="inline-22 text-sm/5 sm:px-2.5 sm:py-1.5 sm:*:text-sm/5 **:data-[slot=select-value]:inline-block **:data-[slot=select-value]:truncate" />
			<SelectContent className="min-inline-0">
				{months.map((month, index) => (
					<SelectItem key={index} id={(index + 1).toString()} textValue={month}>
						<SelectLabel>{month}</SelectLabel>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function SelectYear({ state }: Readonly<{ state: CalendarState }>): ReactNode {
	const t = useExtracted("ui");
	const years: Array<{ value: CalendarDate; formatted: string }> = [];
	const formatter = useDateFormatter({
		year: "numeric",
		timeZone: state.timeZone,
	});

	for (let i = -20; i <= 20; i++) {
		const date = state.focusedDate.add({ years: i });
		years.push({
			value: date,
			formatted: formatter.format(date.toDate(state.timeZone)),
		});
	}
	return (
		<Select
			aria-label={t("Select year")}
			onChange={(value) => {
				const date = years[Number(value)]?.value;
				if (date) {
					state.setFocusedDate(date);
				}
			}}
			value={20}
		>
			<SelectTrigger className="text-sm/5 sm:px-2.5 sm:py-1.5 sm:*:text-sm/5" />
			<SelectContent>
				{years.map((year, i) => (
					<SelectItem key={i} id={i} textValue={year.formatted}>
						<SelectLabel>{year.formatted}</SelectLabel>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function CalendarGridHeader(): ReactNode {
	return (
		<CalendarGridHeaderPrimitive>
			{(day) => (
				<CalendarHeaderCell className="pbe-2 text-center font-semibold text-muted-fg text-sm/6 sm:px-0 sm:py-0.5 lg:text-xs">
					{day}
				</CalendarHeaderCell>
			)}
		</CalendarGridHeaderPrimitive>
	);
}
