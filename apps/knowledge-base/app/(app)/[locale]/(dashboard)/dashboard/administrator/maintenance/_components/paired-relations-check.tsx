"use client";

import { Badge } from "@dariah-eric/ui/badge";
import { Link } from "@dariah-eric/ui/link";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { Paginate } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/paginate";
import { useClientPagination } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/use-client-pagination";
import type {
	PairedRelationCheckResult,
	PairedRelationFindingKind,
	RelationInterval,
} from "@/lib/data/data-integrity";
import { getEntityDetailHref } from "@/lib/entity-detail-href";

interface PairedRelationsCheckProps {
	result: PairedRelationCheckResult;
}

function humanizeKind(kind: string): string {
	return kind.replaceAll("_", " ");
}

const findingKindBadgeIntents: Record<PairedRelationFindingKind, "amber" | "rose"> = {
	missing_counterpart: "amber",
	duration_mismatch: "rose",
};

export function PairedRelationsCheck(props: Readonly<PairedRelationsCheckProps>): ReactNode {
	const { result } = props;

	const t = useExtracted();
	const format = useFormatter();

	const findings = result.findings.map((finding) => {
		return {
			...finding,
			id: `${finding.rule}:${finding.kind}:${finding.personDocumentId}`,
		};
	});

	const { page, pageItems, perPage, setPage, totalItems, totalPages } =
		useClientPagination(findings);

	function formatIntervals(intervals: Array<RelationInterval>): ReactNode {
		if (intervals.length === 0) {
			return "—";
		}

		return intervals.map((interval) => {
			const start = format.dateTime(new Date(interval.start), { dateStyle: "medium" });
			const end =
				interval.end != null
					? format.dateTime(new Date(interval.end), { dateStyle: "medium" })
					: t("ongoing");

			return (
				<span className="block whitespace-nowrap" key={`${interval.start}:${interval.end ?? ""}`}>
					{start} – {end}
				</span>
			);
		});
	}

	return (
		<Fragment>
			{result.errors.length > 0 ? (
				<div className="flex flex-col gap-y-1 text-sm text-danger-subtle-fg">
					{result.errors.map((error) => (
						<p key={error}>{error}</p>
					))}
				</div>
			) : null}

			<Table
				aria-label={t("Paired relations")}
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
			>
				<TableHeader>
					<TableColumn id="person" isRowHeader={true}>
						{t("Person")}
					</TableColumn>
					<TableColumn id="kind">{t("Issue")}</TableColumn>
					<TableColumn id="detail">{t("Detail")}</TableColumn>
					<TableColumn id="periods">{t("Periods")}</TableColumn>
				</TableHeader>
				<TableBody
					items={pageItems}
					renderEmptyState={() => (
						<p className="p-(--gutter) text-sm text-muted-fg">
							{t("No data-integrity issues found.")}
						</p>
					)}
				>
					{(finding) => {
						const href = getEntityDetailHref({
							entityType: "persons",
							slug: finding.personSlug,
						});

						return (
							<TableRow id={finding.id}>
								<TableCell>
									{href != null ? (
										<Link className="underline" href={href}>
											{finding.personLabel}
										</Link>
									) : (
										finding.personLabel
									)}
								</TableCell>
								<TableCell>
									<Badge intent={findingKindBadgeIntents[finding.kind]}>
										{humanizeKind(finding.kind)}
									</Badge>
								</TableCell>
								<TableCell>
									<span className="block whitespace-normal max-inline-96">{finding.detail}</span>
								</TableCell>
								<TableCell>
									<div className="flex flex-col gap-y-2">
										{finding.sides.map((side) => (
											<div className="flex flex-col" key={side.label}>
												<span className="text-xs text-muted-fg">{side.label}</span>
												{formatIntervals(side.intervals)}
											</div>
										))}
									</div>
								</TableCell>
							</TableRow>
						);
					}}
				</TableBody>
			</Table>

			{totalItems > perPage ? (
				<Paginate
					page={page}
					perPage={perPage}
					setPage={setPage}
					total={totalPages}
					totalItems={totalItems}
				/>
			) : null}
		</Fragment>
	);
}
