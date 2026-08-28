type RawSearchParams = Record<string, string | Array<string> | undefined>;

export type ListSortDirection = "asc" | "desc";
export type TableSortDirection = "ascending" | "descending";

export interface ListSearchParams {
	page: number;
	q: string;
}

export interface ListSortSearchParams<TSort extends string> {
	dir: ListSortDirection;
	sort: TSort;
}

export function getSearchParam(
	searchParams: Readonly<RawSearchParams> | undefined,
	key: string,
): string | undefined {
	const value = searchParams?.[key];

	if (Array.isArray(value)) {
		return value[0];
	}

	return value;
}

export function getListSearchParams(
	searchParams: Readonly<RawSearchParams> | undefined,
): ListSearchParams {
	const rawPage = getSearchParam(searchParams, "page");
	const rawQ = getSearchParam(searchParams, "q") ?? "";
	const parsedPage = Number.parseInt(rawPage ?? "1", 10);

	return {
		// Beyond the safe-integer range the derived offset no longer round-trips through Postgres'
		// bigint parameter, so an out-of-range page falls back to the first one like any other
		// unusable value.
		page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
		q: rawQ.trim(),
	};
}

interface GetListSortSearchParamsOptions<TSort extends string> {
	defaultDir?: ListSortDirection;
	defaultSort: TSort;
	validSorts: ReadonlyArray<TSort>;
}

export function getListSortSearchParams<TSort extends string>(
	searchParams: Readonly<RawSearchParams> | undefined,
	options: Readonly<GetListSortSearchParamsOptions<TSort>>,
): ListSortSearchParams<TSort> {
	const { defaultDir = "asc", defaultSort, validSorts } = options;
	const rawSort = getSearchParam(searchParams, "sort");
	const rawDir = getSearchParam(searchParams, "dir");

	const sort =
		rawSort != null && validSorts.includes(rawSort as TSort) ? (rawSort as TSort) : defaultSort;
	const dir: ListSortDirection = rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDir;

	return { dir, sort };
}

export function toListSortDirection(direction: TableSortDirection | undefined): ListSortDirection {
	return direction === "descending" ? "desc" : "asc";
}

export function toTableSortDirection(direction: ListSortDirection): TableSortDirection {
	return direction === "desc" ? "descending" : "ascending";
}
