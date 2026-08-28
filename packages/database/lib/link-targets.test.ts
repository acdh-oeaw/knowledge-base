import { describe, expect, it } from "vitest";

import {
	type ResolvedAssetLinkTarget,
	annotateEntityLinkTargets,
	annotateLinkTargets,
	collectLinkTargetAssetKeys,
	collectLinkTargetEntityIds,
} from "./link-targets";

interface TestNode {
	type: string;
	text?: string;
	marks?: Array<{ type: string; attrs: Record<string, unknown> }>;
	content?: Array<TestNode>;
}

function assetLink(assetKey: string, text = "the flyer"): TestNode {
	return {
		type: "text",
		text,
		marks: [{ type: "link", attrs: { href: null, targetKind: "asset", assetKey } }],
	};
}

function entityLink(entityId: string, text = "our news item"): TestNode {
	return {
		type: "text",
		text,
		marks: [{ type: "link", attrs: { href: null, targetKind: "entity", entityId } }],
	};
}

function externalLink(href: string, text = "elsewhere"): TestNode {
	return { type: "text", text, marks: [{ type: "link", attrs: { href } }] };
}

function doc(...content: Array<TestNode>): TestNode {
	return { type: "doc", content: [{ type: "paragraph", content }] };
}

/** The single mark on the document's first inline node. */
function firstMark(node: TestNode) {
	return node.content![0]!.content![0]!.marks![0]!;
}

const resolved = (url: string): ResolvedAssetLinkTarget => {
	return { url, filename: "flyer.png", mimeType: "image/png", size: 1234 };
};

describe("collectLinkTargetAssetKeys", () => {
	it("finds keys on link marks, which the walker reaches without special-casing `marks`", () => {
		const keys = collectLinkTargetAssetKeys(
			doc(assetLink("documents/a"), assetLink("documents/b")),
		);

		expect(keys).toEqual(new Set(["documents/a", "documents/b"]));
	});

	it("deduplicates a key linked more than once", () => {
		const keys = collectLinkTargetAssetKeys(
			doc(assetLink("documents/a"), assetLink("documents/a", "again")),
		);

		expect(keys.size).toBe(1);
	});

	it("ignores ordinary links, so existing content is untouched", () => {
		expect(collectLinkTargetAssetKeys(doc(externalLink("https://example.com")))).toEqual(new Set());
	});

	it("ignores a link claiming an asset target without a key", () => {
		const malformed = {
			type: "text",
			text: "x",
			marks: [{ type: "link", attrs: { targetKind: "asset", assetKey: "" } }],
		};

		expect(collectLinkTargetAssetKeys(doc(malformed))).toEqual(new Set());
	});

	it("accepts any json shape, so callers can pass a whole field map", () => {
		const fields = { content: [{ type: "rich_text", content: doc(assetLink("documents/a")) }] };

		expect(collectLinkTargetAssetKeys(fields)).toEqual(new Set(["documents/a"]));
	});
});

describe("annotateLinkTargets", () => {
	it("attaches the resolved download and fills in `href` for consumers that only read hrefs", () => {
		const annotated = annotateLinkTargets(
			doc(assetLink("documents/a")),
			new Map([["documents/a", resolved("https://api.example.com/assets/documents/a/download")]]),
		);

		expect(firstMark(annotated).attrs).toMatchObject({
			href: "https://api.example.com/assets/documents/a/download",
			targetKind: "asset",
			assetKey: "documents/a",
			asset: { filename: "flyer.png", mimeType: "image/png", size: 1234 },
		});
	});

	it("leaves a link whose asset is gone unresolved, so no dead href is emitted", () => {
		const input = doc(assetLink("documents/deleted"));
		const annotated = annotateLinkTargets(input, new Map());

		expect(annotated).toBe(input);
		expect(firstMark(annotated).attrs.href).toBeNull();
	});

	it("never touches ordinary links", () => {
		const input = doc(externalLink("https://example.com"));

		expect(annotateLinkTargets(input, new Map([["documents/a", resolved("https://x/y")]]))).toBe(
			input,
		);
	});

	it("returns the input reference unchanged when nothing matched", () => {
		const input = doc({ type: "text", text: "plain" });

		expect(annotateLinkTargets(input, new Map())).toBe(input);
	});

	it("does not mutate the input", () => {
		const input = doc(assetLink("documents/a"));
		const before = structuredClone(input);

		annotateLinkTargets(input, new Map([["documents/a", resolved("https://x/y")]]));

		expect(input).toEqual(before);
	});
});

describe("entity targets", () => {
	const resolvedEntity = { href: "/news/atrium", label: "ATRIUM summer school", type: "news" };

	it("collects document ids, and never confuses them with asset targets", () => {
		const document = doc(entityLink("019f-aaa"), assetLink("documents/a"));

		expect(collectLinkTargetEntityIds(document)).toEqual(new Set(["019f-aaa"]));
		expect(collectLinkTargetAssetKeys(document)).toEqual(new Set(["documents/a"]));
	});

	it("attaches the resolved page and fills in `href`", () => {
		const annotated = annotateEntityLinkTargets(
			doc(entityLink("019f-aaa")),
			new Map([["019f-aaa", resolvedEntity]]),
		);

		expect(firstMark(annotated).attrs).toMatchObject({
			href: "/news/atrium",
			targetKind: "entity",
			entityId: "019f-aaa",
			entity: { label: "ATRIUM summer school", type: "news" },
		});
	});

	it("leaves an unresolvable entity without an href", () => {
		// Deleted, unpublished, or a type with no page of its own — all one case to a renderer.
		const input = doc(entityLink("019f-gone"));
		const annotated = annotateEntityLinkTargets(input, new Map());

		expect(annotated).toBe(input);
		expect(firstMark(annotated).attrs.href).toBeNull();
	});

	it("never touches ordinary or asset links", () => {
		const input = doc(externalLink("https://example.com"), assetLink("documents/a"));

		expect(annotateEntityLinkTargets(input, new Map([["019f-aaa", resolvedEntity]]))).toBe(input);
	});
});
