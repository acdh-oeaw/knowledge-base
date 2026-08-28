/**
 * Human-readable labels for entity types, used e.g. as the secondary line in relation pickers.
 *
 * For `organisational_units` the generic label is replaced by the specific subtype label (e.g.
 * "Working group", "National consortium"), resolved from the unit's `organisationalUnitType`.
 */

/** Entity type -> singular, human-readable label. */
const entityTypeLabels: Record<string, string> = {
	documentation_pages: "Documentation page",
	documents_policies: "Document / policy",
	events: "Event",
	funding_calls: "Funding call",
	impact_case_studies: "Impact case study",
	internal_pages: "Internal page",
	news: "News",
	opportunities: "Opportunity",
	organisational_units: "Organisational unit",
	pages: "Page",
	persons: "Person",
	projects: "Project",
	spotlight_articles: "Spotlight article",
};

/** Organisational-unit subtype -> human-readable label. */
const organisationalUnitTypeLabels: Record<string, string> = {
	governance_body: "Governance body",
	national_consortium: "National consortium",
	country: "Country",
	institution: "Institution",
	regional_hub: "Regional hub",
	eric: "ERIC",
	working_group: "Working group",
};

/** Marketplace resource type -> human-readable label. */
const resourceTypeLabels: Record<string, string> = {
	publication: "Publication",
	service: "Service",
	software: "Software",
	"training-material": "Training material",
	workflow: "Workflow",
};

/** Fallback: turn a raw enum value like `funding_calls` into `Funding calls`. */
function humanize(type: string): string {
	const spaced = type.replaceAll(/[_-]/g, " ");
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function getEntityTypeLabel(args: { entityType: string; unitType?: string | null }): string {
	const { entityType, unitType } = args;

	if (entityType === "organisational_units" && unitType != null) {
		return organisationalUnitTypeLabels[unitType] ?? humanize(unitType);
	}

	return entityTypeLabels[entityType] ?? humanize(entityType);
}

export function getResourceTypeLabel(resourceType: string): string {
	return resourceTypeLabels[resourceType] ?? humanize(resourceType);
}

/**
 * Reverse lookup for type search in the entity relation picker. Returns the raw enum tokens whose
 * human-readable label contains `query` (case-insensitive), so typing e.g. "working group" or
 * "event" matches the labels shown in the list rather than only the raw `entity_types.type` token.
 */
export function getEntityTypeTokensMatchingLabel(query: string): {
	entityTypes: Array<string>;
	unitTypes: Array<string>;
} {
	const q = query.trim().toLowerCase();

	if (q === "") {
		return { entityTypes: [], unitTypes: [] };
	}

	const matches = (label: string): boolean => label.toLowerCase().includes(q);

	return {
		entityTypes: Object.entries(entityTypeLabels)
			.filter(([, label]) => matches(label))
			.map(([token]) => token),
		unitTypes: Object.entries(organisationalUnitTypeLabels)
			.filter(([, label]) => matches(label))
			.map(([token]) => token),
	};
}
