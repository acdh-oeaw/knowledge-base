import type { JSONContent } from "@tiptap/core";

/**
 * Where a rich-text link points. A plain link stores its `href` and needs nothing else; a link that
 * points at something we own stores a _reference_ instead, and read paths resolve it (see
 * `annotateLinkTargets`).
 *
 * The indirection is the point. An `href` typed into the editor is a copy of a url that lives
 * somewhere else: an asset's download url embeds infrastructure the editor should not know about,
 * and an entity's url is derived from a slug that can be renamed out from under it. A reference
 * survives both.
 *
 * `asset` points at a file we store, `entity` at one of our own documents — a news item, a country,
 * a working group. Both are resolved the same way and for the same reason, but from different
 * sources, so each has its own collect/annotate pair below.
 */
export const linkTargetKindsEnum = ["asset", "entity"] as const;

export type LinkTargetKind = (typeof linkTargetKindsEnum)[number];

/** Tiptap's built-in link mark, which carries the target attributes. */
export const linkMarkType = "link";

export function isLinkTargetKind(value: unknown): value is LinkTargetKind {
	return (linkTargetKindsEnum as ReadonlyArray<unknown>).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * The asset key an `asset`-targeted link mark references, or `null` for anything else — an ordinary
 * `href` link, a non-link mark, a node.
 *
 * Marks and nodes share the `{ type, attrs }` shape, so this doubles as the predicate for both and
 * the generic walkers below need no special case for `marks` arrays.
 */
function getLinkTargetAssetKey(value: unknown): string | null {
	if (!isRecord(value) || value.type !== linkMarkType) {
		return null;
	}

	const attrs = value.attrs;
	if (!isRecord(attrs) || attrs.targetKind !== "asset") {
		return null;
	}

	return typeof attrs.assetKey === "string" && attrs.assetKey !== "" ? attrs.assetKey : null;
}

/**
 * Collects the distinct asset keys referenced by `asset`-targeted links anywhere in a JSON
 * structure. Accepts arbitrary JSON (one richtext document, an array of content blocks, ...) so
 * callers can pass whatever shape they hold and resolve each key once.
 *
 * Mirrors `collectPlaceholderValueKinds`, including its tolerance for unknown shapes: anything that
 * is not a recognisable target is walked through, never rejected.
 */
export function collectLinkTargetAssetKeys(value: unknown): Set<string> {
	const keys = new Set<string>();

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

		const key = getLinkTargetAssetKey(node);
		if (key != null) {
			keys.add(key);
		}

		for (const item of Object.values(node)) {
			visit(item);
		}
	}

	visit(value);

	return keys;
}

/** A resolved `asset` target: everything a renderer needs to present and name the download. */
export interface ResolvedAssetLinkTarget {
	url: string;
	filename: string;
	mimeType: string;
	/** File size in bytes, or `null` for assets uploaded before size tracking was added. */
	size: number | null;
}

export type ResolvedAssetLinkTargets = ReadonlyMap<string, ResolvedAssetLinkTarget>;

/**
 * Attaches the resolved download to every `asset`-targeted link mark: an `asset` attribute holding
 * the full metadata, plus `href` set to the download url so a consumer that understands nothing
 * about targets still renders a working link.
 *
 * The url is only ever written onto the outgoing copy, never stored — the same contract as
 * `annotatePlaceholderValues`. Storing it would reintroduce exactly the staleness the reference
 * exists to avoid.
 *
 * A key with no entry (asset deleted since authoring) is left untouched, so it keeps whatever
 * `href` it had — for a stored reference that is none, and the renderer sees a link mark with no
 * href and can degrade to plain text rather than emitting a dead link.
 *
 * Returns the input reference unchanged when nothing matched.
 */
export function annotateLinkTargets<T>(value: T, assets: ResolvedAssetLinkTargets): T {
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

		const key = getLinkTargetAssetKey(node);
		if (key != null) {
			const resolved = assets.get(key);
			if (resolved == null) {
				return node;
			}

			return {
				...node,
				attrs: {
					...(node.attrs as Record<string, unknown>),
					href: resolved.url,
					asset: resolved,
				},
			} satisfies JSONContent;
		}

		let changed = false;
		const result: Record<string, unknown> = {};
		for (const [entry, item] of Object.entries(node)) {
			const next = annotate(item);
			if (next !== item) {
				changed = true;
			}
			result[entry] = next;
		}
		return changed ? result : node;
	}

	return annotate(value) as T;
}

/**
 * The document id an `entity`-targeted link mark references, or `null` for anything else.
 *
 * The reference is the entity's document id, never its slug: a slug is renamed freely by editors,
 * and the whole point of storing a reference is that the link survives that. The url is derived at
 * read time from whatever slug the entity has then.
 */
function getLinkTargetEntityId(value: unknown): string | null {
	if (!isRecord(value) || value.type !== linkMarkType) {
		return null;
	}

	const attrs = value.attrs;
	if (!isRecord(attrs) || attrs.targetKind !== "entity") {
		return null;
	}

	return typeof attrs.entityId === "string" && attrs.entityId !== "" ? attrs.entityId : null;
}

/** Collects the distinct document ids referenced by `entity`-targeted links. */
export function collectLinkTargetEntityIds(value: unknown): Set<string> {
	const ids = new Set<string>();

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

		const id = getLinkTargetEntityId(node);
		if (id != null) {
			ids.add(id);
		}

		for (const item of Object.values(node)) {
			visit(item);
		}
	}

	visit(value);

	return ids;
}

/** A resolved `entity` target: what it is called, and — where the caller knows it — where it lives. */
export interface ResolvedEntityLinkTarget {
	/**
	 * The website url, for callers that can build one. Omitted by callers that can name an entity but
	 * not route to it: the dashboard resolves titles for its previews without reproducing the
	 * website's per-type url rules, and a preview that named the target is worth more than one that
	 * also linked to it. A target with no href annotates its `label` and `type` and leaves the mark's
	 * own href alone, so a renderer still sees "no url" and degrades to plain text.
	 */
	href?: string | null;
	label: string;
	/** The public entity type, e.g. `news`, `country`, `working_group`. */
	type: string;
}

export type ResolvedEntityLinkTargets = ReadonlyMap<string, ResolvedEntityLinkTarget>;

/**
 * Attaches the resolved page to every `entity`-targeted link mark, as an `entity` attribute plus
 * the `href` it lives at — the same contract as {@link annotateLinkTargets}, including that the url
 * is only ever written onto the outgoing copy.
 *
 * An id with no entry is left unresolved, and there are three ordinary ways to get there: the
 * entity was deleted, it is no longer published, or its type has no page of its own (DARIAH-EU
 * itself, an institution not yet placed in a country). All three should render as plain text rather
 * than a link to nowhere, so all three look the same to a renderer.
 */
export function annotateEntityLinkTargets<T>(value: T, entities: ResolvedEntityLinkTargets): T {
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

		const id = getLinkTargetEntityId(node);
		if (id != null) {
			const resolved = entities.get(id);
			if (resolved == null) {
				return node;
			}

			return {
				...node,
				attrs: {
					...(node.attrs as Record<string, unknown>),
					// Only overwritten by a caller that knows a url. Writing `href: undefined` for the rest
					// would erase whatever the mark carried, which is the opposite of leaving it alone.
					...(resolved.href != null ? { href: resolved.href } : {}),
					entity: resolved,
				},
			} satisfies JSONContent;
		}

		let changed = false;
		const result: Record<string, unknown> = {};
		for (const [entry, item] of Object.entries(node)) {
			const next = annotate(item);
			if (next !== item) {
				changed = true;
			}
			result[entry] = next;
		}
		return changed ? result : node;
	}

	return annotate(value) as T;
}
