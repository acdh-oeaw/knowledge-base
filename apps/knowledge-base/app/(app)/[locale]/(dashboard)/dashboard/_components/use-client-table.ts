"use client";

import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import { dashboardPageSize } from "@/config/pagination.config";

type SortValue = string | number | Date | null | undefined;

type SortAccessors<T> = Record<string, (item: T) => SortValue>;

interface UseClientTableParams<T> {
	initialSortDescriptor?: SortDescriptor;
	items: Array<T>;
	pageSize?: number;
	sortAccessors: SortAccessors<T>;
}

interface UseClientTableResult<T> {
	onSortChange: (descriptor: SortDescriptor) => void;
	page: number;
	pageItems: Array<T>;
	setPage: (page: number) => void;
	sortDescriptor: SortDescriptor | undefined;
	total: number;
	totalPages: number;
}

function compareSortValues(a: SortValue, b: SortValue): number {
	if (a == null && b == null) {
		return 0;
	}
	if (a == null) {
		return -1;
	}
	if (b == null) {
		return 1;
	}

	if (typeof a === "string" && typeof b === "string") {
		return a.localeCompare(b);
	}

	// `Number(value)` yields the timestamp for `Date` and the value itself for `number`.
	const aValue = Number(a);
	const bValue = Number(b);

	if (aValue < bValue) {
		return -1;
	}
	if (aValue > bValue) {
		return 1;
	}
	return 0;
}

/**
 * Client-side sorting and pagination for tables that already hold their full row set in local state
 * (e.g. the relation CRUD tabs in dashboard edit forms).
 *
 * Pair with the shared `Table` (`sortDescriptor` / `onSortChange`, `allowsSorting` columns) and
 * `Paginate` components.
 */
export function useClientTable<T>(
	params: Readonly<UseClientTableParams<T>>,
): UseClientTableResult<T> {
	const { initialSortDescriptor, items, pageSize = dashboardPageSize, sortAccessors } = params;

	const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor | undefined>(
		initialSortDescriptor,
	);
	const [page, setPage] = useState(1);

	const sortedItems = useMemo(() => {
		if (sortDescriptor == null) {
			return items;
		}

		const accessor = sortAccessors[String(sortDescriptor.column)];

		if (accessor == null) {
			return items;
		}

		const direction = sortDescriptor.direction === "descending" ? -1 : 1;

		return items.toSorted((a, b) => direction * compareSortValues(accessor(a), accessor(b)));
	}, [items, sortAccessors, sortDescriptor]);

	const total = sortedItems.length;
	const totalPages = Math.max(Math.ceil(total / pageSize), 1);
	const safePage = Math.min(Math.max(page, 1), totalPages);

	const pageItems = useMemo(() => {
		const start = (safePage - 1) * pageSize;
		return sortedItems.slice(start, start + pageSize);
	}, [pageSize, safePage, sortedItems]);

	function onSortChange(descriptor: SortDescriptor) {
		setSortDescriptor(descriptor);
		setPage(1);
	}

	return {
		onSortChange,
		page: safePage,
		pageItems,
		setPage,
		sortDescriptor,
		total,
		totalPages,
	};
}
