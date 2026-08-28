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
import type { InactiveUnitRelationCheckResult } from "@/lib/data/data-integrity";
import { getEntityDetailHref } from "@/lib/entity-detail-href";

interface InactiveUnitRelationsCheckProps {
	result: InactiveUnitRelationCheckResult;
}

function humanizeRole(roleType: string): string {
	return roleType
		.replace(/^is_/, "")
		.replace(/_(?:of|for)$/, "")
		.replaceAll("_", " ");
}

export function InactiveUnitRelationsCheck(
	props: Readonly<InactiveUnitRelationsCheckProps>,
): ReactNode {
	const { result } = props;

	const t = useExtracted();
	const format = useFormatter();

	const findings = result.findings.map((finding) => {
		return {
			...finding,
			id: `${finding.rule}:${finding.unitDocumentId}:${finding.personDocumentId}:${finding.roleType}:${finding.personRelationStart}:${finding.personRelationEnd ?? "ongoing"}`,
		};
	});

	const { page, pageItems, perPage, setPage, totalItems, totalPages } =
		useClientPagination(findings);

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
				aria-label={t("Inactive units")}
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
			>
				<TableHeader>
					<TableColumn id="unit" isRowHeader={true}>
						{t("Organisational unit")}
					</TableColumn>
					<TableColumn id="person">{t("Person")}</TableColumn>
					<TableColumn id="role">{t("Role")}</TableColumn>
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
						const unitHref = getEntityDetailHref({
							entityType: "organisational_units",
							unitType: finding.unitType,
							slug: finding.unitSlug,
						});
						const personHref = getEntityDetailHref({
							entityType: "persons",
							slug: finding.personSlug,
						});

						return (
							<TableRow id={finding.id}>
								<TableCell>
									{unitHref != null ? (
										<Link className="underline" href={unitHref}>
											{finding.unitLabel}
										</Link>
									) : (
										finding.unitLabel
									)}
								</TableCell>
								<TableCell>
									{personHref != null ? (
										<Link className="underline" href={personHref}>
											{finding.personLabel}
										</Link>
									) : (
										finding.personLabel
									)}
								</TableCell>
								<TableCell>
									<Badge intent="amber">{humanizeRole(finding.roleType)}</Badge>
								</TableCell>
								<TableCell>
									<div className="flex flex-col gap-y-2">
										<div className="flex flex-col">
											<span className="text-xs text-muted-fg">{t("Relation")}</span>
											<span className="block whitespace-nowrap text-danger-subtle-fg">
												{format.dateTime(new Date(finding.personRelationStart), {
													dateStyle: "medium",
												})}{" "}
												–{" "}
												{finding.personRelationEnd == null
													? t("ongoing")
													: format.dateTime(new Date(finding.personRelationEnd), {
															dateStyle: "medium",
														})}
											</span>
										</div>
										<div className="flex flex-col">
											<span className="text-xs text-muted-fg">{t("Unit inactive since")}</span>
											<span className="block whitespace-nowrap">
												{format.dateTime(new Date(finding.unitEnd), { dateStyle: "medium" })}
											</span>
										</div>
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
