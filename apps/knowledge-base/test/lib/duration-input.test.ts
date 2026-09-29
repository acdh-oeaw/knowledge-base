import * as v from "valibot";
import { describe, expect, it } from "vitest";

import {
	DurationInputSchema,
	OpenDurationInputSchema,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/duration-input.schema";

function getNestedErrors(schema: v.GenericSchema, input: unknown) {
	const result = v.safeParse(v.object({ duration: schema }), { duration: input });

	return result.success ? undefined : v.flatten(result.issues).nested;
}

describe("DurationInputSchema", () => {
	it("accepts an end on or after the start", () => {
		expect(getNestedErrors(DurationInputSchema, { start: "2024-01-15" })).toBeUndefined();
		expect(
			getNestedErrors(DurationInputSchema, { start: "2024-01-15", end: "2024-01-15" }),
		).toBeUndefined();
		expect(
			getNestedErrors(DurationInputSchema, { start: "2024-01-15", end: "2024-12-31" }),
		).toBeUndefined();
	});

	it("reports an end before the start on the end field", () => {
		expect(
			getNestedErrors(DurationInputSchema, { start: "2024-12-31", end: "2024-01-15" }),
		).toStrictEqual({ "duration.end": ["The end must be on or after the start."] });
	});
});

describe("OpenDurationInputSchema", () => {
	it("accepts either bound on its own", () => {
		expect(getNestedErrors(OpenDurationInputSchema, {})).toBeUndefined();
		expect(getNestedErrors(OpenDurationInputSchema, { start: "2024-01-15" })).toBeUndefined();
		expect(getNestedErrors(OpenDurationInputSchema, { end: "2024-01-15" })).toBeUndefined();
	});

	it("reports an end before the start on the end field", () => {
		expect(
			getNestedErrors(OpenDurationInputSchema, { start: "2024-12-31", end: "2024-01-15" }),
		).toStrictEqual({ "duration.end": ["The end must be on or after the start."] });
	});
});
