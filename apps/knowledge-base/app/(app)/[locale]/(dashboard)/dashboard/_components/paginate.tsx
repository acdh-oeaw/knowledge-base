"use client";

import {
	Pagination,
	PaginationFirst,
	PaginationGap,
	PaginationInfo,
	PaginationItem,
	PaginationLabel,
	PaginationLast,
	PaginationList,
	PaginationNext,
	PaginationPrevious,
	PaginationSection,
	PaginationSpacer,
} from "@dariah-eric/ui/pagination";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import { dashboardPageSize } from "@/config/pagination.config";

function getPaginationRange(current: number, total: number, delta = 2) {
	const range: Array<number> = [];
	const left = Math.max(2, current - delta);
	const right = Math.min(total - 1, current + delta);
	if (total >= 1) {
		range.push(1);
	}
	if (left > 2) {
		range.push(-1);
	}
	for (let i = left; i <= right; i++) {
		range.push(i);
	}
	if (right < total - 1) {
		range.push(-2);
	}
	if (total > 1) {
		range.push(total);
	}
	return range;
}

interface PaginateProps {
	isPending?: boolean;
	page: number;
	perPage?: number;
	setPage: (page: number) => void;
	total: number;
	totalItems?: number;
}

export function Paginate({
	isPending = false,
	page,
	perPage = dashboardPageSize,
	setPage,
	total,
	totalItems,
}: Readonly<PaginateProps>): ReactNode {
	const t = useExtracted();

	const safeTotal = Math.max(total, 1);
	const pages = getPaginationRange(page, safeTotal);
	const totalResults = totalItems ?? safeTotal * perPage;
	const start = totalResults === 0 ? 0 : (page - 1) * perPage + 1;
	const end = totalResults === 0 ? 0 : Math.min(page * perPage, totalResults);

	return (
		<Pagination className="flex-col md:flex-row">
			<PaginationInfo>
				{t.rich(
					"Showing <strong>{start, number}</strong> to <strong>{end, number}</strong> of <strong>{total, number}</strong> results",
					{
						start,
						end,
						total: totalResults,
						strong(chunks) {
							return <strong>{chunks}</strong>;
						},
					},
				)}
			</PaginationInfo>
			<PaginationSpacer />
			<PaginationList className="hidden md:flex">
				<PaginationFirst
					isDisabled={isPending || page === 1}
					onPress={() => {
						setPage(1);
					}}
				/>
				<PaginationPrevious
					isDisabled={isPending || page === 1}
					onPress={() => {
						setPage(page - 1);
					}}
				/>
				<PaginationSection className="**:data-[slot=pagination-item]:min-inline-8">
					{pages.map((n) =>
						n < 0 ? (
							<PaginationGap key={`gap-${String(n)}`} />
						) : (
							<PaginationItem
								key={n}
								isCurrent={n === page}
								isDisabled={isPending}
								onPress={() => {
									setPage(n);
								}}
							>
								{n}
							</PaginationItem>
						),
					)}
				</PaginationSection>
				<PaginationNext
					isDisabled={isPending || page === safeTotal}
					onPress={() => {
						setPage(page + 1);
					}}
				/>
				<PaginationLast
					isDisabled={isPending || page === safeTotal}
					onPress={() => {
						setPage(safeTotal);
					}}
				/>
			</PaginationList>

			<PaginationList className="md:hidden">
				<PaginationFirst
					isDisabled={isPending || page === 1}
					onPress={() => {
						setPage(1);
					}}
				/>
				<PaginationPrevious
					isDisabled={isPending || page === 1}
					onPress={() => {
						setPage(page - 1);
					}}
				/>
				<PaginationSection className="rounded-(--section-radius) border px-3 *:min-inline-4">
					<PaginationLabel>{page}</PaginationLabel>
					<PaginationLabel className="text-muted-fg">/</PaginationLabel>
					<PaginationLabel>{safeTotal}</PaginationLabel>
				</PaginationSection>
				<PaginationNext
					isDisabled={isPending || page === safeTotal}
					onPress={() => {
						setPage(page + 1);
					}}
				/>
				<PaginationLast
					isDisabled={isPending || page === safeTotal}
					onPress={() => {
						setPage(safeTotal);
					}}
				/>
			</PaginationList>
		</Pagination>
	);
}
