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
	CountryMembershipCheckResult,
	CountryMembershipFindingKind,
	RelationInterval,
} from "@/lib/data/data-integrity";
import { getEntityDetailHref } from "@/lib/entity-detail-href";

interface CountryMembershipCheckProps {
	result: CountryMembershipCheckResult;
}

const findingKindBadgeIntents: Record<CountryMembershipFindingKind, "amber" | "rose"> = {
	country_status_missing: "amber",
	country_status_present: "rose",
};

export function CountryMembershipCheck(props: Readonly<CountryMembershipCheckProps>): ReactNode {
	const { result } = props;

	const t = useExtracted();
	const format = useFormatter();

	const findings = result.findings.map((finding) => {
		return {
			...finding,
			id: `${finding.rule}:${finding.unitDocumentId}:${finding.countryDocumentId}`,
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
				aria-label={t("Country membership")}
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
			>
				<TableHeader>
					<TableColumn id="unit" isRowHeader={true}>
						{t("Institution")}
					</TableColumn>
					<TableColumn id="country">{t("Country")}</TableColumn>
					<TableColumn id="detail">{t("Detail")}</TableColumn>
					<TableColumn id="periods">{t("Affected periods")}</TableColumn>
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
							entityType: "organisational_units",
							unitType: finding.unitType,
							slug: finding.unitSlug,
						});
						const countryHref = getEntityDetailHref({
							entityType: "organisational_units",
							unitType: "country",
							slug: finding.countrySlug,
						});

						return (
							<TableRow id={finding.id}>
								<TableCell>
									{href != null ? (
										<Link className="underline" href={href}>
											{finding.unitLabel}
										</Link>
									) : (
										finding.unitLabel
									)}
								</TableCell>
								<TableCell>
									<div className="flex flex-col items-start gap-y-1">
										{countryHref != null ? (
											<Link className="underline" href={countryHref}>
												{finding.countryLabel}
											</Link>
										) : (
											finding.countryLabel
										)}
										<Badge intent={findingKindBadgeIntents[finding.kind]}>
											{finding.kind === "country_status_missing"
												? t("not a member")
												: t("is a member")}
										</Badge>
									</div>
								</TableCell>
								<TableCell>
									<span className="block whitespace-normal max-inline-96">{finding.detail}</span>
								</TableCell>
								<TableCell>{formatIntervals(finding.periods)}</TableCell>
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
