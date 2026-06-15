"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

export interface AsyncOption {
	id: string;
	name: string;
	description?: string;
}

export interface AsyncOptionsPage<T extends AsyncOption> {
	items: Array<T>;
	total: number;
}

export interface AsyncOptionsFetchPageParams {
	limit: number;
	offset: number;
	q: string;
	signal: AbortSignal;
}

export type AsyncOptionsFetchPage<T extends AsyncOption> = (
	params: Readonly<AsyncOptionsFetchPageParams>,
) => Promise<AsyncOptionsPage<T>>;

interface UseAsyncOptionsProps<T extends AsyncOption> {
	fetchPage: AsyncOptionsFetchPage<T>;
	initialItems: Array<T>;
	initialTotal: number;
	pageSize: number;
}

interface UseAsyncOptionsResult<T extends AsyncOption> {
	appliedQ: string;
	displayedItems: Array<T>;
	handleNext: () => void;
	handlePrev: () => void;
	handleSearch: () => void;
	hasNext: boolean;
	hasPrev: boolean;
	isPending: boolean;
	loadError: Error | null;
	offset: number;
	searchText: string;
	setSearchText: (value: string) => void;
	total: number;
}

export function useAsyncOptions<T extends AsyncOption>(
	props: Readonly<UseAsyncOptionsProps<T>>,
): UseAsyncOptionsResult<T> {
	const { fetchPage, initialItems, initialTotal, pageSize } = props;

	const [searchText, setSearchText] = useState("");
	const [appliedQ, setAppliedQ] = useState("");
	const [offset, setOffset] = useState(0);
	const [displayedItems, setDisplayedItems] = useState(initialItems);
	const [total, setTotal] = useState(initialTotal);
	const [loadError, setLoadError] = useState<Error | null>(null);
	const [isPending, startTransition] = useTransition();

	const abortRef = useRef<AbortController | null>(null);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isFirstSearchRef = useRef(true);

	const abort = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
	}, []);

	const runFetch = useCallback(
		(nextOffset: number, q: string) => {
			abort();

			const controller = new AbortController();
			abortRef.current = controller;
			setLoadError(null);

			startTransition(async () => {
				try {
					const result = await fetchPage({
						limit: pageSize,
						offset: nextOffset,
						q,
						signal: controller.signal,
					});

					if (controller.signal.aborted) {
						return;
					}

					setDisplayedItems(result.items);
					setTotal(result.total);
					setOffset(nextOffset);
					setAppliedQ(q);
				} catch (error) {
					if (controller.signal.aborted) {
						return;
					}

					// oxlint-disable-next-line unicorn/no-instanceof-builtins
					setLoadError(error instanceof Error ? error : new Error("Failed to load async options."));
				}
			});
		},
		[abort, fetchPage, pageSize],
	);

	const handleSearch = useCallback(() => {
		if (debounceTimerRef.current != null) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		runFetch(0, searchText.trim());
	}, [runFetch, searchText]);

	const handlePrev = useCallback(() => {
		runFetch(Math.max(offset - pageSize, 0), appliedQ);
	}, [appliedQ, offset, pageSize, runFetch]);

	const handleNext = useCallback(() => {
		runFetch(offset + pageSize, appliedQ);
	}, [appliedQ, offset, pageSize, runFetch]);

	useEffect(() => {
		if (isFirstSearchRef.current) {
			isFirstSearchRef.current = false;
			return;
		}

		const timer = setTimeout(() => {
			debounceTimerRef.current = null;
			runFetch(0, searchText.trim());
		}, 350);
		debounceTimerRef.current = timer;

		return () => {
			clearTimeout(timer);
		};
	}, [searchText, runFetch]);

	useEffect(
		() => () => {
			abort();
		},
		[abort],
	);

	const hasPrev = offset > 0;
	const hasNext = offset + displayedItems.length < total;

	return {
		appliedQ,
		displayedItems,
		handleNext,
		handlePrev,
		handleSearch,
		hasNext,
		hasPrev,
		isPending,
		loadError,
		offset,
		searchText,
		setSearchText,
		total,
	};
}
