import type { JSONContent } from "@tiptap/core";

/** What one nested body becomes: the blocks to write in its place, in order. */
export type SplitPart =
	| { kind: "rich_text"; content: JSONContent }
	| {
			kind: "image";
			imageKey: string;
			caption: JSONContent | null;
			captionMode: "hidden" | "inherit" | "override";
			layout: "default" | "wide" | "full" | "float-start" | "float-end";
	  };

const imageLayouts = new Set(["default", "wide", "full", "float-start", "float-end"]);

function normalizeImageLayout(value: unknown): SplitPart extends { layout: infer T } ? T : never {
	return (imageLayouts.has(value as string) ? value : "default") as never;
}

function normalizeCaptionMode(
	value: unknown,
	caption: JSONContent | null,
): "hidden" | "inherit" | "override" {
	if (value === "hidden" || value === "inherit" || value === "override") {
		return value;
	}

	return caption != null ? "override" : "inherit";
}

/** Splits one stored body at its top-level `assetImage` nodes. */
export function splitBody(content: JSONContent): Array<SplitPart> {
	const parts: Array<SplitPart> = [];
	let run: Array<JSONContent> = [];

	function flush() {
		if (run.length > 0) {
			parts.push({ kind: "rich_text", content: { type: "doc", content: run } });
			run = [];
		}
	}

	for (const node of content.content ?? []) {
		const imageKey = node.type === "assetImage" ? (node.attrs?.imageKey as unknown) : null;

		if (typeof imageKey !== "string" || imageKey === "") {
			run.push(node);
			continue;
		}

		const caption = (node.attrs?.caption as JSONContent | null | undefined) ?? null;

		flush();
		parts.push({
			kind: "image",
			imageKey,
			caption,
			captionMode: normalizeCaptionMode(node.attrs?.captionMode, caption),
			layout: normalizeImageLayout(node.attrs?.layout),
		});
	}

	flush();

	return parts;
}

export interface CandidateRewritePlan {
	parts: Array<SplitPart>;
	unresolvedKeys: Array<string>;
}

/** Decides whether a candidate can be rewritten using the assets currently present. */
export function planCandidateRewrite(
	parts: Array<SplitPart>,
	assetIdsByKey: ReadonlyMap<string, string>,
): CandidateRewritePlan {
	const unresolvedKeys: Array<string> = [];

	for (const part of parts) {
		if (part.kind === "image" && !assetIdsByKey.has(part.imageKey)) {
			unresolvedKeys.push(part.imageKey);
		}
	}

	// The original rich-text node is the only lossless representation of an unresolved image. Do
	// not delete and partially reconstruct it merely because another image in the body resolved.
	return { parts: unresolvedKeys.length > 0 ? [] : parts, unresolvedKeys };
}
