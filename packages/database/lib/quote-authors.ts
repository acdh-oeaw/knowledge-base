/**
 * The authors of the `quoteBlock` rich-text node (see `QuoteNode` in `@dariah-eric/ui`), as read
 * paths and maintenance see them.
 *
 * A quote's byline keeps references, not copies: a person by document id, a typed-in author's
 * picture by asset key. Read paths resolve them — the api to the person's current name, page and
 * portrait, the dashboard to a signed url it can display — so, like `link-targets`, this module
 * only finds the references and rewrites the authors that hold them. Where they resolve to is the
 * caller's business.
 *
 * Every walker accepts arbitrary JSON (one document, an array of content blocks, a whole response)
 * and copies only what it changes, so callers can hand over whatever shape they hold.
 */

export const quoteNodeType = "quoteBlock";

/** An author as stored, before anything is resolved. Unknown fields are carried through. */
export type StoredQuoteAuthor =
	| { kind: "person"; entityId: string; name: string }
	| { kind: "text"; name: string; imageKey?: string; imageUrl?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The author, if this value is one a renderer can use; anything malformed is `null`. */
function toStoredQuoteAuthor(value: unknown): StoredQuoteAuthor | null {
	if (!isRecord(value)) {
		return null;
	}

	const name = typeof value.name === "string" ? value.name.trim() : "";

	if (value.kind === "person" && typeof value.entityId === "string" && value.entityId !== "") {
		return { kind: "person", entityId: value.entityId, name };
	}

	if (value.kind === "text" && name !== "") {
		const imageKey =
			typeof value.imageKey === "string" && value.imageKey !== "" ? value.imageKey : undefined;
		const imageUrl =
			imageKey != null && typeof value.imageUrl === "string" ? value.imageUrl : undefined;

		return {
			kind: "text",
			name,
			...(imageKey != null ? { imageKey } : {}),
			...(imageUrl != null ? { imageUrl } : {}),
		};
	}

	return null;
}

function isQuoteNode(value: unknown): value is Record<string, unknown> & {
	attrs: Record<string, unknown>;
} {
	return isRecord(value) && value.type === quoteNodeType && isRecord(value.attrs);
}

function getQuoteAuthors(node: { attrs: Record<string, unknown> }): Array<StoredQuoteAuthor> {
	const authors = node.attrs.authors;

	return Array.isArray(authors)
		? authors.flatMap((author) => {
				const stored = toStoredQuoteAuthor(author);
				return stored != null ? [stored] : [];
			})
		: [];
}

/** The person document ids and picture asset keys every quote anywhere in `value` refers to. */
export function collectQuoteAuthorReferences(value: unknown): {
	entityIds: Set<string>;
	imageKeys: Set<string>;
} {
	const entityIds = new Set<string>();
	const imageKeys = new Set<string>();

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

		if (isQuoteNode(node)) {
			for (const author of getQuoteAuthors(node)) {
				if (author.kind === "person") {
					entityIds.add(author.entityId);
				} else if (author.imageKey != null) {
					imageKeys.add(author.imageKey);
				}
			}
		}

		for (const item of Object.values(node)) {
			visit(item);
		}
	}

	visit(value);

	return { entityIds, imageKeys };
}

/**
 * Rewrites the authors of every quote anywhere in `value` through `transform`. Malformed authors
 * are dropped on the way, so `transform` only ever sees one a renderer could use.
 *
 * The rest of the structure is left alone, and copied only along the paths to a quote, so the
 * result can be diffed against the input — and passed on unchanged where there is no quote at all.
 */
export function mapQuoteAuthors<T>(value: T, transform: (author: StoredQuoteAuthor) => unknown): T {
	function visit(node: unknown): unknown {
		if (Array.isArray(node)) {
			const items = node.map((item) => visit(item));
			return items.some((item, index) => item !== node[index]) ? items : node;
		}

		if (!isRecord(node)) {
			return node;
		}

		const entries = Object.entries(node).map(([key, item]) => [key, visit(item)] as const);
		const changed = entries.some(([key, item]) => item !== node[key]);
		const rebuilt = changed ? Object.fromEntries(entries) : node;

		if (!isQuoteNode(rebuilt)) {
			return rebuilt;
		}

		const authors = getQuoteAuthors(rebuilt).map(transform);

		// Authors come out of `getQuoteAuthors` as fresh objects, so sameness is decided by value: a
		// quote nothing changed in keeps its identity, and so does everything above it.
		if (JSON.stringify(authors) === JSON.stringify(rebuilt.attrs.authors)) {
			return rebuilt;
		}

		return { ...rebuilt, attrs: { ...rebuilt.attrs, authors } };
	}

	return visit(value) as T;
}

/**
 * Drops the display-only image urls the dashboard signs onto typed-in authors when it loads a
 * document. A url is good for the session that loaded it; the key beside it is what is kept, and
 * the next load signs a fresh one.
 *
 * Returns `value` itself when there is nothing to drop, so a save path can skip a no-op write.
 */
export function stripQuoteAuthorImageUrls<T>(value: T): T {
	return mapQuoteAuthors(value, (author) => {
		if (author.kind !== "text" || author.imageUrl == null) {
			return author;
		}
		const { imageUrl: _imageUrl, ...rest } = author;
		return rest;
	});
}
