import { describe, expect, it } from "vitest";

import { getListSearchParams } from "@/lib/server/list-search-params";

describe("getListSearchParams", () => {
	it("reads a valid page number", () => {
		expect(getListSearchParams({ page: "3" }).page).toBe(3);
	});

	it.each([
		["missing", undefined],
		["not a number", "nope"],
		["zero", "0"],
		["negative", "-1"],
		// The derived offset would reach Postgres in exponential notation, which is not valid bigint.
		["beyond the safe integer range", "1200000000000000000000"],
	])("falls back to the first page when the page is %s", (_label, page) => {
		expect(getListSearchParams(page != null ? { page } : {}).page).toBe(1);
	});
});
