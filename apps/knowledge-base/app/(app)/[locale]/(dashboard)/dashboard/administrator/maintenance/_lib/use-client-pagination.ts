"use client";

import { useEffect, useState } from "react";

import { dashboardPageSize } from "@/config/pagination.config";

interface ClientPagination<T> {
	page: number;
	pageItems: Array<T>;
	perPage: number;
	setPage: (page: number) => void;
	totalItems: number;
	totalPages: number;
}

/**
 * Client-side pagination over an already-loaded array. The maintenance tasks fetch their full
 * result set up front, so we only need to slice it for display. The current page is clamped when
 * the underlying data shrinks (e.g. after a deletion followed by `router.refresh()`).
 */
export function useClientPagination<T>(
	items: Array<T>,
	perPage: number = dashboardPageSize,
): ClientPagination<T> {
	const [page, setPage] = useState(1);

	const totalItems = items.length;
	const totalPages = Math.max(Math.ceil(totalItems / perPage), 1);

	useEffect(() => {
		if (page > totalPages) {
			setPage(totalPages);
		}
	}, [page, totalPages]);

	const start = (page - 1) * perPage;
	const pageItems = items.slice(start, start + perPage);

	return { page, pageItems, perPage, setPage, totalItems, totalPages };
}
