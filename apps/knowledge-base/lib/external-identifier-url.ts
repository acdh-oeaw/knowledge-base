/**
 * ORCID and ROR identifiers are stored as free text and may be a bare identifier
 * (`0000-0002-1825-0097`, `05dxps055`) or an already-qualified url. Normalise either form to a
 * canonical url so it can be rendered as a link, or return `null` when there is nothing to link
 * to.
 */
function toIdentifierUrl(value: string | null | undefined, baseUrl: string): string | null {
	if (value == null) {
		return null;
	}

	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}

	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}

	return `${baseUrl}/${trimmed.replace(/^\/+/, "")}`;
}

export function getOrcidUrl(orcid: string | null | undefined): string | null {
	return toIdentifierUrl(orcid, "https://orcid.org");
}

export function getRorUrl(ror: string | null | undefined): string | null {
	return toIdentifierUrl(ror, "https://ror.org");
}

/**
 * Services are ingested from the "tool-or-service" category of the SSHOC marketplace, so an
 * `sshocMarketplaceId` (the item's persistent id) maps onto a marketplace detail page.
 */
export function getSshocMarketplaceServiceUrl(
	sshocMarketplaceId: string | null | undefined,
	sshocMarketplaceBaseUrl: string | null | undefined,
): string | null {
	if (sshocMarketplaceId == null || sshocMarketplaceBaseUrl == null) {
		return null;
	}

	const id = sshocMarketplaceId.trim();
	if (id.length === 0) {
		return null;
	}

	return `${sshocMarketplaceBaseUrl.replace(/\/+$/, "")}/tool-or-service/${id}`;
}
