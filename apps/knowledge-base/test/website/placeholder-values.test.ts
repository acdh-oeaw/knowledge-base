import {
	type PlaceholderValueKind,
	type ResolvedPlaceholderValues,
	annotatePlaceholderValues,
	collectPlaceholderValueKinds,
	placeholderValueKindLabels,
} from "@dariah-eric/database/placeholder-values";
import { formatPlaceholderValue, toPlainText } from "@dariah-eric/ui/rich-text";
import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

function placeholderValue(kind: string, label?: string): JSONContent {
	return { type: "placeholderValue", attrs: { kind, label: label ?? null } };
}

function doc(...content: Array<JSONContent>): JSONContent {
	return { type: "doc", content: [{ type: "paragraph", content }] };
}

const memberCountries = [
	{ name: "Austria", slug: "austria" },
	{ name: "Belgium", slug: "belgium" },
	{ name: "Croatia", slug: "croatia" },
];

const values: ResolvedPlaceholderValues = new Map<
	PlaceholderValueKind,
	number | Array<{ name: string; slug: string }>
>([
	["member_countries_count", 23],
	["member_countries_list", memberCountries],
]);

describe("collectPlaceholderValueKinds", () => {
	it("finds kinds nested anywhere in a JSON structure", () => {
		const blocks = [
			{ type: "rich_text", content: doc(placeholderValue("member_countries_count")) },
			{
				type: "accordion",
				content: {
					items: [{ title: "a", content: doc(placeholderValue("member_countries_list")) }],
				},
			},
		];

		expect(collectPlaceholderValueKinds(blocks)).toStrictEqual(
			new Set(["member_countries_count", "member_countries_list"]),
		);
	});

	it("ignores unknown kinds and unrelated nodes", () => {
		const content = doc({ type: "text", text: "hello" }, placeholderValue("not_a_real_kind"), {
			type: "buttonLink",
			attrs: { label: "x" },
		});

		expect(collectPlaceholderValueKinds(content)).toStrictEqual(new Set());
		expect(collectPlaceholderValueKinds(null)).toStrictEqual(new Set());
	});
});

describe("annotatePlaceholderValues", () => {
	it("attaches resolved data as a value attribute, keeping the node", () => {
		const content = doc(
			{ type: "text", text: "DARIAH has " },
			placeholderValue("member_countries_count"),
			{ type: "text", text: " member countries." },
		);

		const annotated = annotatePlaceholderValues(content, values);

		expect(annotated.content?.[0]?.content?.[1]).toStrictEqual({
			type: "placeholderValue",
			attrs: { kind: "member_countries_count", label: null, value: 23 },
		});
	});

	it("leaves nodes with unresolved kinds untouched", () => {
		const node = placeholderValue("working_groups_count");
		const content = doc(node);

		const annotated = annotatePlaceholderValues(content, values);

		expect(annotated.content?.[0]?.content?.[0]).toBe(node);
	});

	it("returns the input reference unchanged when nothing matches", () => {
		const content = doc({ type: "text", text: "plain" });

		expect(annotatePlaceholderValues(content, values)).toBe(content);
	});
});

describe("formatPlaceholderValue", () => {
	it("renders counts as digits and lists as conjunction-joined names", () => {
		expect(formatPlaceholderValue({ value: 23 })).toBe("23");
		expect(formatPlaceholderValue({ value: memberCountries })).toBe(
			"Austria, Belgium, and Croatia",
		);
	});

	it("returns null for unresolved nodes", () => {
		expect(formatPlaceholderValue({ kind: "member_countries_count", value: null })).toBeNull();
		expect(formatPlaceholderValue(null)).toBeNull();
	});
});

describe("toPlainText", () => {
	it("flattens annotated nodes to their formatted value", () => {
		const content = annotatePlaceholderValues(
			doc(
				{ type: "text", text: "Members: " },
				placeholderValue("member_countries_list"),
				{ type: "text", text: " (" },
				placeholderValue("member_countries_count"),
				{ type: "text", text: " countries)." },
			),
			values,
		);

		expect(toPlainText(content)).toBe("Members: Austria, Belgium, and Croatia (23 countries).");
	});

	it("falls back to the label for raw references", () => {
		const content = doc(
			placeholderValue("working_groups_count", placeholderValueKindLabels.working_groups_count),
		);

		expect(toPlainText(content)).toBe(placeholderValueKindLabels.working_groups_count);
	});
});
