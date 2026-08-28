import { describe, expect, it } from "vitest";

import { normalizeSearchTerms } from "@/lib/db/search";

describe("normalizeSearchTerms", () => {
	it("splits on whitespace", () => {
		expect(normalizeSearchTerms("clarin eric")).toEqual(["clarin", "eric"]);
	});

	it("treats punctuation as a separator", () => {
		// A comma the user may or may not type must not change the tokens.
		expect(normalizeSearchTerms("Culture, Innovation")).toEqual(["culture", "innovation"]);
		expect(normalizeSearchTerms("CLARIN-ERIC")).toEqual(["clarin", "eric"]);
		expect(normalizeSearchTerms("services / tools")).toEqual(["services", "tools"]);
	});

	it("lowercases and strips accents to mirror the column normalization", () => {
		expect(normalizeSearchTerms("Öl für")).toEqual(["ol", "fur"]);
	});

	it('splits "&" out so it lines up with the column\'s "&" -> "and" mapping', () => {
		// "R&D" -> ["r", "d"]; the stored "R&D" normalizes to "r and d", which contains both.
		expect(normalizeSearchTerms("R&D")).toEqual(["r", "d"]);
		expect(normalizeSearchTerms("R and D")).toEqual(["r", "and", "d"]);
	});

	it("drops empty terms from surrounding or repeated separators", () => {
		expect(normalizeSearchTerms("  spaced   out  ")).toEqual(["spaced", "out"]);
		expect(normalizeSearchTerms(",-&")).toEqual([]);
		expect(normalizeSearchTerms("")).toEqual([]);
	});
});
