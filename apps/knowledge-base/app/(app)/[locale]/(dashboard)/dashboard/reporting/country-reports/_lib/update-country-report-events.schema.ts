import * as v from "valibot";

const nullableInteger = v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0)));

export const UpdateCountryReportEventsActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	smallEvents: nullableInteger,
	mediumEvents: nullableInteger,
	largeEvents: nullableInteger,
	veryLargeEvents: nullableInteger,
	// Free-text *title* of the DARIAH-commissioned event (an amount-bearing event type), distinct from
	// the numeric count fields above. Reject a purely-numeric value to catch a count fat-fingered here;
	// titles containing digits (e.g. "2nd DARIAH Annual Event") still pass.
	dariahCommissionedEvent: v.optional(
		v.pipe(
			v.string(),
			v.check(
				(value) => !/^\s*\d+(?:[.,]\d+)?\s*$/u.test(value),
				"Enter the event title, not a number.",
			),
		),
	),
	reusableOutcomes: v.optional(v.string()),
});
