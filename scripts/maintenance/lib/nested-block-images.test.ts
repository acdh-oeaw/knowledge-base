import { describe, expect, it } from "vitest";

import { planCandidateRewrite, splitBody } from "./nested-block-images";

describe("planCandidateRewrite", () => {
	it("does not rewrite a body when any embedded image is unresolved", () => {
		const parts = splitBody({
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "Before" }] },
				{ type: "assetImage", attrs: { imageKey: "resolved" } },
				{ type: "assetImage", attrs: { imageKey: "missing" } },
			],
		});

		expect(planCandidateRewrite(parts, new Map([["resolved", "asset-id"]]))).toEqual({
			parts: [],
			unresolvedKeys: ["missing"],
		});
	});
});
