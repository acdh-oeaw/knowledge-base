import * as schema from "@dariah-eric/database/schema";

import type { ReportStatus, ReportingStatisticsFilters } from "@/lib/data/admin-reporting";
import { getSearchParam } from "@/lib/server/list-search-params";

type RawSearchParams = Record<string, string | Array<string> | undefined>;

/**
 * URL keys for the filter bar shared by every reporting-statistics tab. The bar lives in the
 * section layout and the tables live in the pages, so both sides have to agree on these names —
 * hence a single exported source rather than string literals on either side.
 */
export const statisticsFilterKeys = ["campaignYear", "country", "status"] as const;

/** The raw, string-shaped filter values, as the selects in the filter bar want them. */
export interface StatisticsFilterValues {
	campaignYear: string;
	country: string;
	status: string;
}

export function isReportStatus(value: string): value is ReportStatus {
	return (schema.reportStatusEnum as ReadonlyArray<string>).includes(value);
}

/**
 * Parse the shared filters out of the search params, dropping anything unusable so a hand-edited
 * URL degrades to "no filter" rather than erroring.
 */
export function getStatisticsFilters(
	searchParams: Readonly<RawSearchParams> | undefined,
): ReportingStatisticsFilters {
	const rawCampaignYear = getSearchParam(searchParams, "campaignYear") ?? "";
	const rawCountry = getSearchParam(searchParams, "country") ?? "";
	const rawStatus = getSearchParam(searchParams, "status") ?? "";
	const campaignYear = Number.parseInt(rawCampaignYear, 10);

	return {
		campaignYear: Number.isSafeInteger(campaignYear) ? campaignYear : undefined,
		countryName: rawCountry !== "" ? rawCountry : undefined,
		status: isReportStatus(rawStatus) ? rawStatus : undefined,
	};
}
