import * as v from "valibot";

// A react-aria date picker submits a timezone-agnostic wall-clock string: date-only ("2024-01-15",
// all-day) or date-time ("2024-01-15T13:00:00", timed). Per the UTC-as-standin-for-local convention
// that wall-clock is stored verbatim as UTC.
const WALL_CLOCK_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/;

function wallClockToUtc(value: string): Date {
	return new Date(value.length === 10 ? `${value}T00:00:00Z` : `${value}Z`);
}

export const EventDurationInputSchema = v.pipe(
	v.object({
		start: v.pipe(
			v.string(),
			v.regex(WALL_CLOCK_RE, "Invalid start date."),
			v.transform(wallClockToUtc),
		),
		end: v.optional(
			v.pipe(
				v.string(),
				v.check((value) => value === "" || WALL_CLOCK_RE.test(value), "Invalid end date."),
				v.transform((value) => (value === "" ? undefined : wallClockToUtc(value))),
			),
		),
	}),
	// A `tstzrange` requires lower <= upper (Postgres throws otherwise), and an event cannot end
	// before it starts. Report it on the end field.
	v.forward(
		v.check(
			(input) => input.end == null || input.end.getTime() >= input.start.getTime(),
			"The end must be on or after the start.",
		),
		["end"],
	),
);

function toUtcStartOfDay(value: Date): Date {
	return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toUtcEndOfDay(value: Date): Date {
	return new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59),
	);
}

/**
 * Apply the all-day storage convention: all-day events span whole days (`[00:00:00, 23:59:59]`) so
 * their range actually covers each day for the API's range-overlap filtering; timed events keep
 * their wall-clock time. The range is always bounded — a missing end collapses to `start` — never
 * open-ended, because the API's upcoming-events filter treats a null upper bound as "ongoing
 * forever". Mirrors `getEventDuration` in the WordPress migration so dashboard-authored and
 * migrated events share one shape.
 */
export function normalizeEventDuration(
	duration: { start: Date; end?: Date | undefined },
	isFullDay: boolean,
): { start: Date; end: Date } {
	const end = duration.end ?? duration.start;

	if (!isFullDay) {
		return { start: duration.start, end };
	}

	return { start: toUtcStartOfDay(duration.start), end: toUtcEndOfDay(end) };
}
