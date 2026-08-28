import type { JSONContent } from "@tiptap/core";

/**
 * Name of the inline Tiptap atom node that references a placeholder value. Stored documents only
 * hold the node with a `kind` attribute; read paths attach the current data as a `value` attribute
 * (see `annotatePlaceholderValues`) and renderers format it, so the rendered text never goes
 * stale.
 */
export const placeholderValueNodeType = "placeholderValue";

export const placeholderValueKindsEnum = [
	"member_countries_count",
	"member_countries_list",
	"observer_countries_count",
	"observer_countries_list",
	"member_and_observer_countries_count",
	"member_and_observer_countries_list",
	"cooperating_partner_countries_count",
	"cooperating_partner_countries_list",
	"partner_institutions_count",
	"cooperating_partners_count",
	"working_groups_count",
] as const;

export type PlaceholderValueKind = (typeof placeholderValueKindsEnum)[number];

/** Human-readable labels, shown in the editor insert menu and as placeholder chip text. */
export const placeholderValueKindLabels: Record<PlaceholderValueKind, string> = {
	member_countries_count: "Number of member countries",
	member_countries_list: "List of member countries",
	observer_countries_count: "Number of observer countries",
	observer_countries_list: "List of observer countries",
	member_and_observer_countries_count: "Number of member and observer countries",
	member_and_observer_countries_list: "List of member and observer countries",
	cooperating_partner_countries_count: "Number of cooperating partner countries",
	cooperating_partner_countries_list: "List of cooperating partner countries",
	partner_institutions_count: "Number of partner institutions",
	cooperating_partners_count: "Number of cooperating partners",
	working_groups_count: "Number of working groups",
};

export function isPlaceholderValueKind(value: unknown): value is PlaceholderValueKind {
	return (placeholderValueKindsEnum as ReadonlyArray<unknown>).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getPlaceholderValueNodeKind(value: unknown): PlaceholderValueKind | null {
	if (!isRecord(value) || value.type !== placeholderValueNodeType) {
		return null;
	}

	const attrs = value.attrs;
	if (!isRecord(attrs) || !isPlaceholderValueKind(attrs.kind)) {
		return null;
	}

	return attrs.kind;
}

/**
 * Collects the distinct placeholder-value kinds referenced anywhere in a JSON structure. Accepts
 * arbitrary JSON (a single richtext document, an array of content blocks, ...) so callers can pass
 * whatever shape they hold and resolve each kind once.
 */
export function collectPlaceholderValueKinds(value: unknown): Set<PlaceholderValueKind> {
	const kinds = new Set<PlaceholderValueKind>();

	function visit(node: unknown) {
		if (Array.isArray(node)) {
			for (const item of node) {
				visit(item);
			}
			return;
		}

		if (!isRecord(node)) {
			return;
		}

		const kind = getPlaceholderValueNodeKind(node);
		if (kind != null) {
			kinds.add(kind);
			return;
		}

		for (const item of Object.values(node)) {
			visit(item);
		}
	}

	visit(value);

	return kinds;
}

/** An entry of a `*_list` kind: the country's display name plus its slug, so consumers can link. */
export interface PlaceholderValueListItem {
	name: string;
	slug: string;
}

/** A resolved placeholder value: a number for `*_count` kinds, countries for `*_list` kinds. */
export type PlaceholderValue = number | Array<PlaceholderValueListItem>;

const listFormatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/**
 * Default presentation for a resolved `placeholderValue` node: counts as digits, lists joined as
 * "A, B, and C" (names only — consumers wanting links render the items themselves). Returns null
 * when the node carries no resolved `value` attribute (raw editor content, or an unknown kind the
 * server left untouched) — callers fall back to the node's label.
 */
export function formatPlaceholderValue(
	attrs: Record<string, unknown> | null | undefined,
): string | null {
	const value = attrs?.value;

	if (typeof value === "number") {
		return String(value);
	}

	if (Array.isArray(value)) {
		const names = value
			.map((item) => {
				if (typeof item === "string") {
					return item;
				}
				if (isRecord(item) && typeof item.name === "string") {
					return item.name;
				}
				return null;
			})
			.filter((name): name is string => name != null);

		return listFormatter.format(names);
	}

	return null;
}

export type ResolvedPlaceholderValues = ReadonlyMap<PlaceholderValueKind, PlaceholderValue>;

/**
 * Attaches the resolved data to every `placeholderValue` node in a JSON structure as a `value`
 * attribute (a number for counts, an array of names for lists). The node itself stays in the
 * document — renderers own the presentation (list joining, links, ...) and fall back to the node's
 * `label` when no value is attached. Returns the input reference unchanged when the structure
 * contains no placeholder values.
 */
export function annotatePlaceholderValues<T>(value: T, values: ResolvedPlaceholderValues): T {
	function annotate(node: unknown): unknown {
		if (Array.isArray(node)) {
			let changed = false;
			const result: Array<unknown> = [];
			for (const item of node) {
				const next = annotate(item);
				if (next !== item) {
					changed = true;
				}
				result.push(next);
			}
			return changed ? result : node;
		}

		if (!isRecord(node)) {
			return node;
		}

		const kind = getPlaceholderValueNodeKind(node);
		if (kind != null) {
			const resolved = values.get(kind);
			if (resolved == null) {
				return node;
			}

			return {
				...node,
				attrs: { ...(node.attrs as Record<string, unknown>), value: resolved },
			} satisfies JSONContent;
		}

		let changed = false;
		const result: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(node)) {
			const next = annotate(item);
			if (next !== item) {
				changed = true;
			}
			result[key] = next;
		}
		return changed ? result : node;
	}

	return annotate(value) as T;
}
