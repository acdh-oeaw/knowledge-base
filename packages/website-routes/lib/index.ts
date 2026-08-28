/**
 * Canonical entity → DARIAH website href resolver.
 *
 * Single source of truth for the URL structure of the public DARIAH website
 * (github.com/DARIAH-ERIC/dariah-website). The templates below are derived from that repo's typed
 * route folders under `app/(default)/…` and MUST be kept in sync with them (see
 * docs/website-url-resolution.md).
 *
 * Values are root-relative and locale-less; most are bare pathnames, but a type whose entity is
 * selected _within_ a page carries a query string (governance bodies) — hence "href", not
 * "pathname".
 *
 * Pure, locale-less and zero-dependency by design, so the module can be published and consumed by
 * the website repo unchanged. Consumers are responsible for prepending the locale segment and
 * origin.
 */

export { interimPagePathBySlug, resolveInterimPagePath } from "./interim-page-paths";

/**
 * The full website entity vocabulary. Kept in sync with the CMS entity-type and
 * organisational-unit-subtype enums by tests in the consuming packages (a new content type must be
 * added here).
 */
export const websiteEntityTypes = [
	"country",
	"document-or-policy",
	"eric",
	"event",
	"funding-call",
	"governance-body",
	"impact-case-study",
	"institution",
	"national-consortium",
	"news-item",
	"opportunity",
	"page",
	"person",
	"project",
	"regional-hub",
	"spotlight-article",
	"working-group",
] as const;

export type WebsiteEntityType = (typeof websiteEntityTypes)[number];

/**
 * Every website type is routable except `eric`: DARIAH-EU itself is the whole site, not an entity
 * page, and resolving it to `/` would emit a link that navigates without informing. Consumers
 * surface it as plain text instead.
 *
 * Two routes are prerequisites for the links this resolver emits (both on
 * github.com/DARIAH-ERIC/dariah-website), and must ship before Phase 1 emits their links: -
 * `person` needs the `persons/[slug]` route. - `page` needs the single page catch-all that renders
 * a CMS page by its stored `path`; page paths are validated to not collide with the website's
 * existing typed routes (they win by priority).
 */
export const routableEntityTypes = [
	"country",
	"document-or-policy",
	"event",
	"funding-call",
	"governance-body",
	"impact-case-study",
	"institution",
	"national-consortium",
	"news-item",
	"opportunity",
	"page",
	"person",
	"project",
	"regional-hub",
	"spotlight-article",
	"working-group",
] as const satisfies ReadonlyArray<WebsiteEntityType>;

export type RoutableEntityType = (typeof routableEntityTypes)[number];

/**
 * Params per type. Most detail pages need the entity's own slug; institutions and national
 * consortia have no page of their own and resolve to their country's page; document-or-policy and
 * regional-hub are single pages with no slug; a page carries its full author-defined `path`.
 */
export type GetEntityHrefParams =
	| {
			type: Exclude<
				RoutableEntityType,
				"document-or-policy" | "institution" | "national-consortium" | "page" | "regional-hub"
			>;
			slug: string;
	  }
	| { type: "document-or-policy" | "regional-hub" }
	| { type: "institution" | "national-consortium"; countrySlug: string }
	| { type: "page"; path: string };

/**
 * Resolve an entity to its locale-less website href (leading slash, no origin, may carry a query
 * string).
 */
export function getEntityHref(params: GetEntityHrefParams): string {
	switch (params.type) {
		case "news-item": {
			return `/news/${params.slug}`;
		}
		case "event": {
			return `/events/${params.slug}`;
		}
		case "person": {
			return `/persons/${params.slug}`;
		}
		case "project": {
			return `/projects/${params.slug}`;
		}
		case "spotlight-article": {
			return `/spotlight/${params.slug}`;
		}
		case "impact-case-study": {
			return `/about/impact-case-studies/${params.slug}`;
		}
		case "funding-call": {
			return `/get-involved/funding-calls/${params.slug}`;
		}
		case "opportunity": {
			return `/get-involved/opportunities/${params.slug}`;
		}
		case "working-group": {
			return `/network/working-groups/${params.slug}`;
		}
		case "governance-body": {
			// Governance bodies have no page of their own: the organisation-and-governance page
			// selects one via a query param.
			return `/about/organisation-and-governance?selectedBody=${encodeURIComponent(params.slug)}`;
		}
		case "country": {
			return `/network/members-and-partners/${params.slug}`;
		}
		case "regional-hub": {
			// The hub listing has no per-hub detail page.
			return "/network/regional-hubs";
		}
		case "institution":
		case "national-consortium": {
			return `/network/members-and-partners/${params.countrySlug}`;
		}
		case "document-or-policy": {
			return "/about/documents";
		}
		case "page": {
			// The stored path is already the full, root-relative, locale-less pathname.
			return params.path;
		}
	}
}

/**
 * Types that have a collection/overview (listing) page on the website. The rest have no listing of
 * their own: institutions/consortia are surfaced within the country listing, governance bodies and
 * regional hubs within a single CMS page, and `page`, `person` and `eric` have no collection
 * (`eric` has no page at all).
 */
export const listableEntityTypes = [
	"country",
	"document-or-policy",
	"event",
	"funding-call",
	"impact-case-study",
	"news-item",
	"opportunity",
	"project",
	"spotlight-article",
	"working-group",
] as const satisfies ReadonlyArray<WebsiteEntityType>;

export type ListableEntityType = (typeof listableEntityTypes)[number];

/**
 * The listing/overview pathname for a type's collection (locale-less, root-relative).
 * Single-sources the paths nav items currently hardcode as raw `href` strings (e.g. `/news`,
 * `/get-involved/funding-calls`).
 */
export function getEntityListHref(type: ListableEntityType): string {
	switch (type) {
		case "news-item": {
			return "/news";
		}
		case "event": {
			return "/events";
		}
		case "project": {
			return "/projects";
		}
		case "spotlight-article": {
			return "/spotlight";
		}
		case "impact-case-study": {
			return "/about/impact-case-studies";
		}
		case "funding-call": {
			return "/get-involved/funding-calls";
		}
		case "opportunity": {
			return "/get-involved/opportunities";
		}
		case "working-group": {
			return "/network/working-groups";
		}
		case "country": {
			return "/network/members-and-partners";
		}
		case "document-or-policy": {
			return "/about/documents";
		}
	}
}
