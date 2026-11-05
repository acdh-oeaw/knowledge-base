/**
 * Canonical entity → CLARIAH-AT website href resolver.
 *
 * Single source of truth for the URL structure of the public CLARIAH-AT website
 * (github.com/acdh-oeaw/clariah-at-platform). The templates below are derived from that repo's
 * route folders under `app/(app)/[locale]/(default)/…` and MUST be kept in sync with them.
 *
 * Values are root-relative and locale-less. Pure and zero-dependency by design; consumers are
 * responsible for prepending the locale segment and origin.
 */

/**
 * The entity types with a page on the website. Any other type has no url, and consumers must not
 * link to it.
 */
export const routableEntityTypes = [
	"event",
	"institution",
	"news-item",
	"page",
	"project",
] as const;

export type RoutableEntityType = (typeof routableEntityTypes)[number];

export interface GetEntityHrefParams {
	type: RoutableEntityType;
	slug: string;
}

/** Pages holding the content of a listing page, which is where they are shown on the website. */
const listingHrefByPageSlug: ReadonlyMap<string, string> = new Map([
	["projects", "/projects"],
	["projekte", "/projects"],
	["resources", "/resources"],
]);

/**
 * Resolve an entity to its locale-less website href (leading slash, no origin).
 *
 * An `institution` only has a page while it is a member of the national consortium, which callers
 * need to check.
 */
export function getEntityHref(params: GetEntityHrefParams): string {
	const { type, slug } = params;

	switch (type) {
		case "event": {
			return `/events/${slug}`;
		}
		case "institution": {
			return `/consortium/${slug}`;
		}
		case "news-item": {
			return `/news/${slug}`;
		}
		case "page": {
			return listingHrefByPageSlug.get(slug) ?? `/pages/${slug}`;
		}
		case "project": {
			return `/projects/${slug}`;
		}
	}
}
