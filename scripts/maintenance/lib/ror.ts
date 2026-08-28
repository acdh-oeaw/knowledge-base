import { createUrl, createUrlSearchParams } from "@acdh-oeaw/lib";
import { type RequestOptions, request } from "@dariah-eric/request";
import { HttpError } from "@dariah-eric/request/errors";

/**
 * Minimal binding for ROR's affiliation matcher. Kept here rather than in a `client-ror` package
 * because this is the only consumer and the only endpoint used; promote it if that changes.
 */

interface RorName {
	value: string;
	types: Array<string>;
}

interface RorLocation {
	/** Wire format, hence the snake case. */
	geonames_details?: {
		country_name?: string;
		name?: string;
	};
}

interface RorOrganization {
	id: string;
	names: Array<RorName>;
	locations?: Array<RorLocation>;
}

export interface RorMatch {
	chosen: boolean;
	score: number;
	/** Wire format, hence the snake case. Always `SINGLE SEARCH` with score 1 for a chosen match. */
	matching_type: string;
	organization: RorOrganization;
}

interface RorAffiliationResponse {
	items: Array<RorMatch>;
}

/**
 * Retry transient failures. 429 matters most here: a backfill run issues several hundred sequential
 * requests, and ROR throttles rather than hard-failing, so an exponential backoff turns a throttle
 * into a pause instead of a dead run.
 */
const retry: RequestOptions["retry"] = {
	backoff: "exponential",
	delayMs: 2000,
	times: 4,
	shouldRetry(error) {
		if (error._tag === "NetworkError" || error._tag === "TimeoutError") {
			return true;
		}

		if (HttpError.is(error)) {
			return error.response.status >= 500 || error.response.status === 429;
		}

		return false;
	},
};

export interface RorClient {
	matchAffiliation(affiliation: string): Promise<RorMatch | null>;
	getOrganization(rorId: string): Promise<RorOrganization | null>;
}

export function createRorClient(params: { baseUrl: string }): RorClient {
	return {
		/** The single match ROR is confident enough to pick, if any. */
		async matchAffiliation(affiliation: string): Promise<RorMatch | null> {
			const result = await request<RorAffiliationResponse>(
				createUrl({
					baseUrl: params.baseUrl,
					pathname: "/v2/organizations",
					searchParams: createUrlSearchParams({ affiliation }),
				}),
				{ responseType: "json", retry, timeout: 30_000 },
			);

			const { data } = result.unwrap();

			return data.items.find((item) => item.chosen) ?? null;
		},

		/** Direct lookup by id, for a unit whose ROR is already known. `null` if withdrawn or invalid. */
		async getOrganization(rorId: string): Promise<RorOrganization | null> {
			const result = await request<RorOrganization>(
				createUrl({ baseUrl: params.baseUrl, pathname: `/v2/organizations/${rorId}` }),
				{ responseType: "json", retry, timeout: 30_000 },
			);

			if (result.isErr()) {
				if (HttpError.is(result.error) && result.error.response.status === 404) {
					return null;
				}

				throw result.error;
			}

			return result.value.data;
		},
	};
}

/** Every name ROR knows the organisation by — display name, labels and aliases alike. */
export function getRorNames(organization: RorOrganization): Array<string> {
	return organization.names.map((name) => name.value);
}

export function getRorDisplayName(organization: RorOrganization): string | null {
	const display = organization.names.find((name) => name.types.includes("ror_display"));

	return display?.value ?? organization.names[0]?.value ?? null;
}

/** Primary location, used both to disambiguate generic names and to show a reviewer where it is. */
export function getRorLocation(organization: RorOrganization): {
	country: string | null;
	city: string | null;
} {
	const details = organization.locations?.[0]?.geonames_details;

	return { country: details?.country_name ?? null, city: details?.name ?? null };
}
