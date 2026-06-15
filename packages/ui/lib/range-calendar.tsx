"use client";

import { getLocalTimeZone, today } from "@internationalized/date";
import type { ReactNode } from "react";
import {
	CalendarCell,
	CalendarGrid,
	CalendarGridBody,
	type DateValue,
	RangeCalendar as RangeCalendarPrimitive,
	type RangeCalendarProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { CalendarGridHeader, CalendarHeader } from "@/lib/calendar";

export function RangeCalendar<T extends DateValue>(
	props: Readonly<RangeCalendarProps<T>>,
): ReactNode {
	const { className: _, visibleDuration = { months: 1 }, ...rest } = props;

	const now = today(getLocalTimeZone());

	return (
		<RangeCalendarPrimitive data-slot="calendar" visibleDuration={visibleDuration} {...rest}>
			<CalendarHeader isRange={true} />
			<div className="flex snap-x items-start justify-stretch gap-6 overflow-auto sm:gap-10">
				{/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
				{Array.from({ length: visibleDuration?.months ?? 1 }).map((_, index) => {
					const id = index + 1;
					return (
						<CalendarGrid
							key={index}
							className="[&_td]:border-collapse [&_td]:px-0 [&_td]:py-0.5"
							offset={id >= 2 ? { months: id - 1 } : undefined}
						>
							<CalendarGridHeader />
							<CalendarGridBody className="snap-start">
								{(date) => (
									<CalendarCell
										className={twMerge([
											"shrink-0 [--cell-fg:var(--color-primary-subtle-fg)] [--cell:var(--color-primary-subtle)]",
											"group/calendar-cell relative block-11 inline-11 cursor-default outline-hidden leading-[2.286rem] selection-start:rounded-s-lg selection-end:rounded-e-lg outside-month:text-muted-fg sm:block-9 sm:inline-9 sm:text-sm",
											"selected:bg-(--cell) selected:text-(--cell-fg)",
											"selected:after:bg-primary-fg focus-visible:after:bg-primary-fg",
											"invalid:selected:bg-danger-subtle",
											"[td:first-child_&]:rounded-s-lg [td:last-child_&]:rounded-e-lg",
											"forced-colors:selected:bg-[Highlight] forced-colors:selected:text-[HighlightText] forced-colors:invalid:selected:bg-[Mark]",
											date.compare(now) === 0 &&
												"after:pointer-events-none after:absolute after:inset-s-1/2 after:inset-be-1 after:z-10 after:block-[3px] after:inline-[3px] after:-translate-x-1/2 after:rounded-full after:bg-primary selected:after:bg-primary-fg",
										])}
										date={date}
									>
										{({
											formattedDate,
											isSelected,
											isSelectionStart,
											isSelectionEnd,
											isDisabled,
										}) => (
											<span
												className={twMerge(
													"flex block-full inline-full items-center justify-center rounded-lg tabular-nums forced-color-adjust-none",
													isSelected && (isSelectionStart || isSelectionEnd)
														? "bg-primary text-primary-fg group-invalid/calendar-cell:bg-danger group-invalid/calendar-cell:text-danger-fg forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:group-invalid/calendar-cell:bg-[Mark]"
														: isSelected
															? [
																	// hover
																	"group-hover/calendar-cell:bg-primary/15",
																	// pressed
																	"group-pressed/calendar-cell:bg-(--cell)",
																	// invalid
																	"group-invalid/calendar-cell:text-danger-subtle-fg group-invalid/calendar-cell:group-hover/calendar-cell:bg-danger/15 group-invalid/calendar-cell:group-pressed/calendar-cell:bg-danger/30",
																	// forced-colors
																	"forced-colors:text-[HighlightText] forced-colors:group-pressed/calendar-cell:bg-[Highlight] forced-colors:group-hover/calendar-cell:bg-[Highlight] forced-colors:group-invalid/calendar-cell:group-pressed/calendar-cell:bg-[Mark] forced-colors:group-invalid:group-hover/calendar-cell:bg-[Mark]",
																]
															: "group-hover/calendar-cell:bg-secondary-fg/15 group-pressed/calendar-cell:bg-secondary-fg/20 forced-colors:group-pressed/calendar-cell:bg-[Highlight]",
													isDisabled && "opacity-50 forced-colors:text-[GrayText]",
												)}
											>
												{formattedDate}
											</span>
										)}
									</CalendarCell>
								)}
							</CalendarGridBody>
						</CalendarGrid>
					);
				})}
			</div>
		</RangeCalendarPrimitive>
	);
}
