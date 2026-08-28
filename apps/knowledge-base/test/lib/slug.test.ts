import slugify from "@sindresorhus/slugify";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { EntitySlugInputSchema } from "@/lib/entity-slug-input";
import {
	assertSlugWithinMaxLength,
	getSlugLength,
	isSlugTooLong,
	maxSlugLength,
	truncateSlug,
} from "@/lib/slug";
import { UserFacingError } from "@/lib/user-facing-error";

function slugOfLength(length: number): string {
	return "a".repeat(length);
}

describe("getSlugLength", () => {
	it("counts bytes, not characters", () => {
		expect(getSlugLength("abc")).toBe(3);
		// A character `slugify` did not reduce to ASCII still has to fit the byte budget.
		expect(getSlugLength("日")).toBe(3);
	});
});

describe("truncateSlug", () => {
	it("leaves a slug within the limit untouched", () => {
		const slug = slugOfLength(maxSlugLength);

		expect(truncateSlug(slug)).toBe(slug);
	});

	it("cuts a slug over the limit down to it", () => {
		const truncated = truncateSlug(slugOfLength(maxSlugLength + 100));

		expect(getSlugLength(truncated)).toBe(maxSlugLength);
	});

	it("does not leave a trailing hyphen where it cut", () => {
		const slug = `${slugOfLength(maxSlugLength - 1)}--word`;

		expect(truncateSlug(slug)).toBe(slugOfLength(maxSlugLength - 1));
	});

	it("cuts on a character boundary rather than mid-sequence", () => {
		// Three bytes per character, so the limit falls inside the last one that would fit.
		const slug = "日".repeat(10);

		const truncated = truncateSlug(slug, 8);

		expect(truncated).toBe("日日");
		expect(getSlugLength(truncated)).toBe(6);
	});

	it("honours an explicit limit below the default", () => {
		expect(truncateSlug("history-of-dariah", 7)).toBe("history");
	});
});

describe("assertSlugWithinMaxLength", () => {
	it("accepts a slug at the limit", () => {
		expect(() => {
			assertSlugWithinMaxLength(slugOfLength(maxSlugLength));
		}).not.toThrow();
	});

	/** A typed error, so the action wrappers show a real message instead of "internal server error". */
	it("rejects a slug one byte over the limit with a user-facing error", () => {
		expect(() => {
			assertSlugWithinMaxLength(slugOfLength(maxSlugLength + 1));
		}).toThrow(UserFacingError);
		expect(isSlugTooLong(slugOfLength(maxSlugLength + 1))).toBe(true);
	});
});

describe("EntitySlugInputSchema", () => {
	it("accepts a slug at the limit", () => {
		expect(v.safeParse(EntitySlugInputSchema, slugOfLength(maxSlugLength)).success).toBe(true);
	});

	it("rejects a slug over the limit", () => {
		const result = v.safeParse(EntitySlugInputSchema, slugOfLength(maxSlugLength + 1));

		expect(result.success).toBe(false);
	});

	/**
	 * The check runs on the slugified value: a title pasted into the field is only too long if it is
	 * still too long once spaces and punctuation have been normalised away.
	 */
	it("judges the length of the slug that would be stored, not of what was typed", () => {
		const typed = "word - ".repeat(49);
		expect(typed.length).toBeGreaterThan(maxSlugLength);
		expect(getSlugLength(slugify(typed))).toBeLessThanOrEqual(maxSlugLength);

		expect(v.safeParse(EntitySlugInputSchema, typed).success).toBe(true);
	});

	/**
	 * Why the `maxLength` on the field cannot be the rule: it caps UTF-16 code units of what is
	 * typed, and transliteration expands — a field full of umlauts stays under that cap while
	 * slugifying to twice the bytes.
	 */
	it("rejects input that only becomes too long once transliterated", () => {
		const typed = "ä".repeat(maxSlugLength);
		expect(typed.length).toBe(maxSlugLength);
		expect(getSlugLength(slugify(typed))).toBeGreaterThan(maxSlugLength);

		expect(v.safeParse(EntitySlugInputSchema, typed).success).toBe(false);
	});

	it("still accepts an empty field, which means “derive one from the title”", () => {
		expect(v.safeParse(EntitySlugInputSchema, "").success).toBe(true);
		expect(v.safeParse(EntitySlugInputSchema, undefined).success).toBe(true);
	});
});
