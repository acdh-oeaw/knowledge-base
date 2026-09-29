import * as v from "valibot";

const DateInputSchema = v.pipe(v.string(), v.isoDate(), v.toDate());

const endBeforeStartMessage = "The end must be on or after the start.";

/**
 * A date-picker duration with a required start. A `tstzrange` requires lower <= upper (Postgres
 * throws otherwise), so a reversed range is reported on the end field instead.
 */
export const DurationInputSchema = v.pipe(
	v.object({
		start: DateInputSchema,
		end: v.optional(DateInputSchema),
	}),
	v.forward(
		v.check((input) => input.end == null || input.end >= input.start, endBeforeStartMessage),
		["end"],
	),
);

/** Like {@link DurationInputSchema}, for durations where either bound may be left open. */
export const OpenDurationInputSchema = v.pipe(
	v.object({
		start: v.optional(DateInputSchema),
		end: v.optional(DateInputSchema),
	}),
	v.forward(
		v.check(
			(input) => input.start == null || input.end == null || input.end >= input.start,
			endBeforeStartMessage,
		),
		["end"],
	),
);
