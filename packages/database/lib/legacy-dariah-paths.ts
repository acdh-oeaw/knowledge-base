/**
 * Pathnames of the dariah website, which the content this knowledge base was imported from links
 * to. Only `richtext-link-cleanup-service` needs them, to recognise and rewrite those links. They
 * are not the routes of the CLARIAH-AT website: those live in `@dariah-eric/website-routes`.
 *
 * CMS `page` entities carry only a single-segment slug: the WordPress import
 * (`normalizeWordPressSlug`) dropped the section prefix, so a page's nested pathname
 * (`/about/strategy`) cannot be derived from CMS data, and a slug may deliberately differ from the
 * path leaf (`transformations-a-dariah-journal` → `/resources/transformations`), so a hardcoded map
 * is required.
 *
 * Authoritative source: DARIAH-ERIC/knowledge-base issue #703 ("Map page slugs to website paths").
 */
export const interimPagePathBySlug: Readonly<Record<string, string>> = {
	// About
	"dariah-in-a-nutshell": "/about/dariah-in-a-nutshell",
	strategy: "/about/strategy",
	"organisation-and-governance": "/about/organisation-and-governance",
	"impact-case-studies": "/about/impact-case-studies",
	// Network
	"members-and-partners": "/network/members-and-partners",
	"partnerships-and-collaborations": "/network/partnerships-and-collaborations",
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

/** The dariah website pathname for a CMS page slug, or null when the page has no known route. */
export function resolveInterimPagePath(slug: string): string | null {
	return interimPagePathBySlug[slug] ?? null;
}

/** Types with a listing page on the dariah website. */
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
] as const;

export type ListableEntityType = (typeof listableEntityTypes)[number];

/** The listing pathname of a type on the dariah website (locale-less, root-relative). */
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
