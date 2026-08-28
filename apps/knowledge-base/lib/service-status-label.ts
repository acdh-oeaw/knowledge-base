/**
 * Human-readable labels for service statuses, used in the service admin tables, the edit form
 * select, and on read-only detail pages.
 */

const serviceStatusLabels: Record<string, string> = {
	discontinued: "Discontinued",
	live: "Live",
	needs_review: "Needs review",
	to_be_discontinued: "To be discontinued",
};

/** Fallback: turn an unmapped status token into a capitalized, space-separated label. */
function humanize(status: string): string {
	return status.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function getServiceStatusLabel(status: string): string {
	return serviceStatusLabels[status] ?? humanize(status);
}
