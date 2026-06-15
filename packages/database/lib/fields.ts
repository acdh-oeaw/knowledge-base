/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as p from "drizzle-orm/pg-core";
import * as v from "valibot";

import { now } from "./functions";

export function timestamp(name: string) {
	return p.timestamp(name, {
		mode: "date",
		precision: 3,
		withTimezone: true,
	});
}

export function timestamps() {
	return {
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => now()),
		// deletedAt: timestamp("deleted_at"),
	};
}

export const TimestampRange = v.pipe(
	v.object({
		start: v.date(),
		end: v.optional(v.date()),
	}),
	v.check(({ start, end }) => !end || start <= end),
);

export const NullableTimestampRange = v.nullable(TimestampRange);

type TimestampRange = v.InferInput<typeof TimestampRange>;

export const timestampRange = p.customType<{
	data: TimestampRange;
	driverData: string;
}>({
	dataType() {
		return "tstzrange";
	},
	toDriver({ start, end }) {
		return `[${start.toISOString()},${end?.toISOString() ?? ""}]`;
	},
	fromDriver(value: string): TimestampRange {
		const [start, end] = value.slice(1, -1).split(",");

		return {
			start: new Date(start!),
			end: end != null && end !== "" ? new Date(end) : undefined,
		};
	},
});
