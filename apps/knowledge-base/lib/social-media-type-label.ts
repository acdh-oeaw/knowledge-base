/**
 * Human-readable labels for social media account types, used in the outreach social media picker
 * (list + tags), in the person social media editor, and on read-only detail pages.
 *
 * Keyed by the raw type token rather than by either enum, so it serves both `social_media_types`
 * and `person_social_media_types` — the two vocabularies are separate tables but agree on the
 * spelling of the platforms they share.
 */

const socialMediaTypeLabels: Record<string, string> = {
	academia_edu: "Academia.edu",
	bluesky: "Bluesky",
	facebook: "Facebook",
	flickr: "Flickr",
	github: "GitHub",
	gitlab: "GitLab",
	google_scholar: "Google Scholar",
	humanities_commons: "Humanities Commons",
	hypotheses: "Hypotheses",
	instagram: "Instagram",
	linkedin: "LinkedIn",
	mastodon: "Mastodon",
	researchgate: "ResearchGate",
	twitter: "Twitter",
	vimeo: "Vimeo",
	website: "Website",
	youtube: "YouTube",
	zenodo: "Zenodo",
	other: "Other",
};

/** Fallback: capitalize the first letter of an unmapped type token. */
function humanize(type: string): string {
	return type.charAt(0).toUpperCase() + type.slice(1);
}

export function getSocialMediaTypeLabel(type: string): string {
	return socialMediaTypeLabels[type] ?? humanize(type);
}
