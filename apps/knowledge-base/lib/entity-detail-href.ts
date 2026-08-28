/**
 * Builds dashboard detail-page hrefs for related entities shown on detail pages.
 *
 * Returns `null` when the entity type has no dashboard detail page (e.g. the `regional_hub`
 * organisational-unit subtype), so callers can fall back to plain text.
 */

/** Organisational-unit subtype -> `administrator/<segment>` route segment. */
const organisationalUnitDetailSegments: Record<string, string | undefined> = {
	governance_body: "governance-bodies",
	institution: "institutions",
	national_consortium: "national-consortia",
	country: "countries",
	eric: "eric",
	working_group: "working-groups",
	// `regional_hub` has no dashboard detail page.
};

/** Entity type -> dashboard detail route (minus the trailing `/<slug>/details`). */
const entityDetailRoutes: Record<string, string | undefined> = {
	documentation_pages: "administrator/documentation-pages",
	internal_pages: "administrator/internal-pages",
	persons: "administrator/persons",
	projects: "administrator/projects",
	documents_policies: "website/documents-policies",
	events: "website/events",
	funding_calls: "website/funding-calls",
	impact_case_studies: "website/impact-case-studies",
	news: "website/news",
	opportunities: "website/opportunities",
	pages: "website/pages",
	spotlight_articles: "website/spotlight-articles",
	// `organisational_units` is resolved via its subtype in `getEntityDetailHref`.
};

export function getOrganisationalUnitDetailHref(unitType: string, slug: string): string | null {
	const segment = organisationalUnitDetailSegments[unitType];
	return segment != null ? `/dashboard/administrator/${segment}/${slug}/details` : null;
}

export function getEntityDetailHref(args: {
	entityType: string;
	unitType?: string | null;
	slug: string;
}): string | null {
	const { entityType, unitType, slug } = args;

	if (entityType === "organisational_units") {
		return unitType != null ? getOrganisationalUnitDetailHref(unitType, slug) : null;
	}

	const route = entityDetailRoutes[entityType];
	return route != null ? `/dashboard/${route}/${slug}/details` : null;
}
