/**
 * TEMPORARY — interim page-slug → website-pathname map.
 *
 * CMS `page` entities carry only a single-segment slug: the WordPress import
 * (`normalizeWordPressSlug`) dropped the section prefix, so a page's real nested pathname
 * (`/about/strategy`) cannot be derived from CMS data — and a slug may deliberately differ from the
 * path leaf (`transformations-a-dariah-journal` → `/resources/transformations`), so a hardcoded map
 * is required.
 *
 * Authoritative source: DARIAH-ERIC/knowledge-base issue #703 ("Map page slugs to website paths"),
 * the hand-curated mapping. This is also the backfill source for the eventual `pages.path` column.
 *
 * DELETE this file once pages own an explicit `path` column (see the page-path workstream in
 * docs/website-url-resolution.md); the indexer/API then pass the stored path to
 * {@link getEntityHref} directly. Pages whose slug is not listed here have no (known) website route
 * and must not be linked — {@link resolveInterimPagePath} returns null so callers skip them and no
 * broken (404) search links are emitted.
 *
 * Not included: `partnerships-and-collaborations` — its target path is unresolved in #703.
 */
export const interimPagePathBySlug: Readonly<Record<string, string>> = {
	// About
	"dariah-in-a-nutshell": "/about/dariah-in-a-nutshell",
	strategy: "/about/strategy",
	"organisation-and-governance": "/about/organisation-and-governance",
	"impact-case-studies": "/about/impact-case-studies",
	// Network
	"members-and-partners": "/network/members-and-partners",
	"regional-hubs": "/network/regional-hubs",
	"working-groups": "/network/working-groups",
	// Resources
	"resource-catalogue": "/resources/resource-catalogue",
	"dariah-campus": "/resources/dariah-campus",
	"transformations-a-dariah-journal": "/resources/transformations",
	"ssh-open-marketplace": "/resources/ssh-open-marketplace",
	// Projects / news / events / spotlights
	projects: "/projects",
	spotlight: "/spotlight",
	newsletters: "/newsletters",
	// Get involved
	"join-dariah": "/get-involved/join-dariah",
	// Footer (privacy & legal) — these are CMS `page` entities, not fixed chrome
	"legal-notice": "/privacy-and-legal/legal-notice",
	"accessibility-declaration": "/privacy-and-legal/accessibility-declaration",
};

/**
 * The current website pathname for a CMS page slug, or null when the page has no known route.
 * Interim bridge until pages own a `path` column.
 */
export function resolveInterimPagePath(slug: string): string | null {
	return interimPagePathBySlug[slug] ?? null;
}
