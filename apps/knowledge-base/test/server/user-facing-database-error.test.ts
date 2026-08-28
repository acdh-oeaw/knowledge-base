import { describe, expect, it } from "vitest";

import { getUserFacingDatabaseError } from "@/lib/db/errors";

describe("getUserFacingDatabaseError", () => {
	it("recognises an entity slug conflict through Drizzle's cause chain", () => {
		const error = new Error("Failed query", {
			cause: Object.assign(new Error("duplicate key value violates unique constraint"), {
				code: "23505",
				constraint: "slugs_published_type_locale_value_unique",
			}),
		});

		expect(getUserFacingDatabaseError(error)).toBe("entity-slug-conflict");
	});

	it.each([
		["23505", "unique-conflict"],
		["23503", "missing-related-record"],
		["23P01", "record-conflict"],
		["23514", "invalid-data"],
		["23502", "missing-data"],
	] as const)("maps PostgreSQL error %s to %s", (code, expected) => {
		expect(getUserFacingDatabaseError({ code })).toBe(expected);
	});

	it("does not expose unknown database or application errors", () => {
		expect(getUserFacingDatabaseError({ code: "42P01" })).toBeNull();
		expect(getUserFacingDatabaseError(new Error("unexpected"))).toBeNull();
	});
});
