"use client";

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import type { SortDescriptor } from "react-aria-components";

import { usePathname, useRouter, useSearchParams } from "@/lib/navigation/navigation";
import {
	type ListSortDirection,
	toListSortDirection,
	toTableSortDirection,
} from "@/lib/server/list-search-params";

type UrlPaginatedFilters = Record<string, string>;

interface UseUrlPaginatedSearchParams<TFilters extends UrlPaginatedFilters = Record<never, never>> {
	debounceMs?: number;
	dir?: ListSortDirection;
	filters?: TFilters;
	page: number;
	q: string;
	sort?: string;
}

interface UseUrlPaginatedSearchResult<TFilters extends UrlPaginatedFilters = Record<never, never>> {
	dir: ListSortDirection | undefined;
	filters: TFilters;
	inputValue: string;
	isPending: boolean;
	page: number;
	q: string;
	setFilter: <TKey extends keyof TFilters>(key: TKey, value: TFilters[TKey]) => void;
	setInputValue: (value: string) => void;
	setPage: (page: number) => void;
	setSort: (sort: string, dir: ListSortDirection) => void;
	setSortDescriptor: (descriptor: SortDescriptor) => void;
	sort: string | undefined;
	sortDescriptor: SortDescriptor | undefined;
}

interface UrlPaginatedSearchState<TFilters extends UrlPaginatedFilters> {
	dir?: ListSortDirection;
	filters: TFilters;
	page: number;
	q: string;
	sort?: string;
}

export function useUrlPaginatedSearch<TFilters extends UrlPaginatedFilters = Record<never, never>>(
	params: Readonly<UseUrlPaginatedSearchParams<TFilters>>,
): UseUrlPaginatedSearchResult<TFilters> {
	const { debounceMs = 300, dir, filters, page, q, sort } = params;

	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();
	const initialState: UrlPaginatedSearchState<TFilters> = {
		dir,
		filters: (filters ?? {}) as TFilters,
		page,
		q,
		sort,
	};
	const [optimisticState, setOptimisticState] = useOptimistic<
		UrlPaginatedSearchState<TFilters>,
		UrlPaginatedSearchState<TFilters>
	>(initialState, (_currentState, nextState) => nextState);
	const [inputValue, setInputValue] = useState(q);
	const committedQ = useRef(q);

	const replaceState = useCallback(
		(nextState: Readonly<UrlPaginatedSearchState<TFilters>>) => {
			const params = new URLSearchParams(searchParams.toString());

			if (nextState.q !== "") {
				params.set("q", nextState.q);
			} else {
				params.delete("q");
			}

			if (nextState.page > 1) {
				params.set("page", String(nextState.page));
			} else {
				params.delete("page");
			}

			if (nextState.sort != null && nextState.sort !== "") {
				params.set("sort", nextState.sort);
				params.set("dir", nextState.dir ?? "asc");
			} else {
				params.delete("sort");
				params.delete("dir");
			}

			for (const [key, value] of Object.entries(nextState.filters)) {
				if (value !== "") {
					params.set(key, value);
				} else {
					params.delete(key);
				}
			}

			const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;

			startTransition(() => {
				setOptimisticState(nextState);
				router.replace(href, { scroll: false });
			});
		},
		[pathname, router, searchParams, setOptimisticState],
	);

	useEffect(() => {
		if (q !== committedQ.current) {
			setInputValue(q);
		}
		committedQ.current = q;
	}, [q]);

	useEffect(() => {
		const handle = window.setTimeout(() => {
			const nextQ = inputValue.trim();

			if (nextQ === optimisticState.q) {
				return;
			}

			committedQ.current = nextQ;
			replaceState({
				dir: optimisticState.dir,
				filters: optimisticState.filters,
				page: 1,
				q: nextQ,
				sort: optimisticState.sort,
			});
		}, debounceMs);

		return () => {
			window.clearTimeout(handle);
		};
	}, [
		debounceMs,
		inputValue,
		optimisticState.dir,
		optimisticState.filters,
		optimisticState.q,
		optimisticState.sort,
		replaceState,
	]);

	const setPage = useCallback(
		(nextPage: number) => {
			replaceState({
				dir: optimisticState.dir,
				filters: optimisticState.filters,
				page: Math.max(nextPage, 1),
				q: optimisticState.q,
				sort: optimisticState.sort,
			});
		},
		[
			optimisticState.dir,
			optimisticState.filters,
			optimisticState.q,
			optimisticState.sort,
			replaceState,
		],
	);

	const setFilter = useCallback(
		<TKey extends keyof TFilters>(key: TKey, value: TFilters[TKey]) => {
			replaceState({
				dir: optimisticState.dir,
				filters: {
					...optimisticState.filters,
					[key]: value,
				},
				page: 1,
				q: optimisticState.q,
				sort: optimisticState.sort,
			});
		},
		[
			optimisticState.dir,
			optimisticState.filters,
			optimisticState.q,
			optimisticState.sort,
			replaceState,
		],
	);

	const setSort = useCallback(
		(nextSort: string, nextDir: ListSortDirection) => {
			replaceState({
				dir: nextDir,
				filters: optimisticState.filters,
				page: 1,
				q: optimisticState.q,
				sort: nextSort,
			});
		},
		[optimisticState.filters, optimisticState.q, replaceState],
	);

	const setSortDescriptor = useCallback(
		(descriptor: SortDescriptor) => {
			setSort(String(descriptor.column), toListSortDirection(descriptor.direction));
		},
		[setSort],
	);

	const sortDescriptor =
		optimisticState.sort != null && optimisticState.dir != null
			? {
					column: optimisticState.sort,
					direction: toTableSortDirection(optimisticState.dir),
				}
			: undefined;

	return {
		dir: optimisticState.dir,
		filters: optimisticState.filters,
		inputValue,
		isPending,
		page: optimisticState.page,
		q: optimisticState.q,
		setFilter,
		setInputValue,
		setPage,
		setSort,
		setSortDescriptor,
		sort: optimisticState.sort,
		sortDescriptor,
	};
}
