import { UserFacingError } from "@/lib/user-facing-error";

/**
 * The longest slug we allow, in bytes.
 *
 * A slug is the last segment of an entity's public URL, and the website prerenders one file per
 * URL: the segment `generateStaticParams` returns ends up in a filename on disk, together with the
 * suffixes Next.js appends to it, and the whole name has to stay inside the filesystem's 255-byte
 * limit. 246 bytes is what Next.js handles there, so anything longer breaks a website build rather
 * than the form that created it — long after whoever chose the slug could act on it.
 *
 * Counted in bytes rather than characters, because that is what the filename limit counts. Slugs
 * are ASCII in practice, since `slugify` transliterates, but nothing guarantees every input reduces
 * to one byte per character.
 */
export const maxSlugLength = 246;

const encoder = new TextEncoder();

/** A slug's length in bytes — the unit `maxSlugLength` is expressed in. */
export function getSlugLength(slug: string): number {
	return encoder.encode(slug).length;
}

/** Whether `slug` is longer than a URL segment may be. */
export function isSlugTooLong(slug: string): boolean {
	return getSlugLength(slug) > maxSlugLength;
}

/**
 * Cut `slug` down to at most `maxLength` bytes.
 *
 * For slugs we derive ourselves, where the alternative — refusing the write — would fail a create
 * over a title the user cannot see the consequences of. A slug the user typed is rejected instead,
 * so they can choose how to shorten it.
 *
 * Cuts on a character boundary, never mid-sequence, and drops any hyphen the cut exposes at the
 * end, so the result stays a well-formed slug.
 */
export function truncateSlug(slug: string, maxLength = maxSlugLength): string {
	if (getSlugLength(slug) <= maxLength) {
		return slug;
	}

	let truncated = "";
	let length = 0;

	for (const character of slug) {
		const characterLength = getSlugLength(character);
		if (length + characterLength > maxLength) {
			break;
		}
		truncated += character;
		length += characterLength;
	}

	return truncated.replace(/-+$/, "");
}

/**
 * Refuse a slug that would not fit in a URL segment.
 *
 * The data layer's own guard: slugs coming from an entity form are already checked by
 * `EntitySlugInputSchema`, but the maintenance slug editor and any non-form caller are not, and a
 * slug that reaches the database over-length is only discovered when the website next builds.
 */
export function assertSlugWithinMaxLength(slug: string): void {
	if (isSlugTooLong(slug)) {
		throw new UserFacingError("slug-too-long");
	}
}
