"use client";

import { Link } from "@dariah-eric/ui/link";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { Paginate } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/paginate";
import { useClientPagination } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/use-client-pagination";
import type { UnitRelationRequirementCheckResult } from "@/lib/data/data-integrity";
import { getEntityDetailHref } from "@/lib/entity-detail-href";

interface UnitRelationRequirementsCheckProps {
	result: UnitRelationRequirementCheckResult;
}

export function UnitRelationRequirementsCheck(
	props: Readonly<UnitRelationRequirementsCheckProps>,
): ReactNode {
	const { result } = props;

	const t = useExtracted();

	const findings = result.findings.map((finding) => {
		return { ...finding, id: `${finding.rule}:${finding.unitDocumentId}` };
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
				aria-label={t("Unit relation requirements")}
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
			>
				<TableHeader>
					<TableColumn id="unit" isRowHeader={true}>
						{t("Organisational unit")}
					</TableColumn>
					<TableColumn id="has">{t("Has")}</TableColumn>
					<TableColumn id="missing">{t("Missing")}</TableColumn>
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
									<span className="block whitespace-normal max-inline-96">
										{finding.triggerLabel}
									</span>
								</TableCell>
								<TableCell>
									<span className="block whitespace-normal text-danger-subtle-fg max-inline-96">
										{finding.requiredLabel}
									</span>
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
