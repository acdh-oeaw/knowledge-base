import { getSearchParam } from "@/lib/server/list-search-params";

type RawSearchParams = Record<string, string | Array<string> | undefined>;

/**
 * Read the KPI-category filter, validated against the categories the entity can actually report.
 *
 * The two KPI tabs have different category sets, so the caller passes its own enum; anything else
 * in the URL degrades to "no filter" rather than to an empty table.
 */
export function getKpiSearchParam<TKpi extends string>(
	searchParams: Readonly<RawSearchParams> | undefined,
	categories: ReadonlyArray<TKpi>,
): TKpi | undefined {
	const raw = getSearchParam(searchParams, "kpi") ?? "";

	return (categories as ReadonlyArray<string>).includes(raw) ? (raw as TKpi) : undefined;
}
