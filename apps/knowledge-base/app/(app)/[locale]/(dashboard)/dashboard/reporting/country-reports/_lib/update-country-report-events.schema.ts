import * as v from "valibot";

const nullableInteger = v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0)));

export const UpdateCountryReportEventsActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	smallEvents: nullableInteger,
	mediumEvents: nullableInteger,
	largeEvents: nullableInteger,
	veryLargeEvents: nullableInteger,
	dariahCommissionedEvent: v.optional(v.string()),
	reusableOutcomes: v.optional(v.string()),
});
