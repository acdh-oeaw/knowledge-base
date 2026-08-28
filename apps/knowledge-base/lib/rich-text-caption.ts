import { isEmptyRichTextDocument } from "@dariah-eric/ui/rich-text";
import type { JSONContent } from "@tiptap/core";
import * as v from "valibot";

/**
 * Parses a richtext caption submitted as a JSON string (from a form's hidden input) into Tiptap
 * JSON. Missing, unparseable, or empty documents collapse to `null` so we never persist an
 * empty-paragraph placeholder.
 */
function parseRichTextCaptionValue(value: unknown): JSONContent | null {
	if (typeof value !== "string" || value.trim() === "") {
		return null;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return null;
	}

	const content = parsed as JSONContent;

	return isEmptyRichTextDocument(content) ? null : content;
}

/** {@link parseRichTextCaptionValue} as a valibot schema, for server action inputs. */
export const RichTextCaptionFormSchema = v.pipe(
	v.optional(v.string()),
	v.transform((value: string | undefined): JSONContent | null => parseRichTextCaptionValue(value)),
);

/**
 * {@link RichTextCaptionFormSchema} for a column that always carries the caption of one placement: a
 * field that was not submitted means "no caption" and is stored as `null`, rather than dropping out
 * of the input and leaving whatever the column held before.
 */
export const RichTextCaptionColumnSchema = v.pipe(
	v.optional(v.string(), ""),
	v.transform((value: string): JSONContent | null => parseRichTextCaptionValue(value)),
);
