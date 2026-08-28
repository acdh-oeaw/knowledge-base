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
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { Paginate } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/paginate";
import { useClientPagination } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/use-client-pagination";
import type {
	HeadingHierarchyCheckResult,
	HeadingHierarchyFindingKind,
} from "@/lib/data/data-integrity";
import { getEntityDetailHref } from "@/lib/entity-detail-href";

interface HeadingHierarchyCheckProps {
	result: HeadingHierarchyCheckResult;
}

const findingKindBadgeIntents: Record<HeadingHierarchyFindingKind, "amber" | "rose"> = {
	disallowed_level: "rose",
	does_not_start_at_top: "amber",
	skipped_level: "amber",
};

function humanizeType(value: string): string {
	return value.replaceAll("_", " ");
}

export function HeadingHierarchyCheck(props: Readonly<HeadingHierarchyCheckProps>): ReactNode {
	const { result } = props;

	const t = useExtracted();

	const findingKindLabels: Record<HeadingHierarchyFindingKind, string> = {
		disallowed_level: t("disallowed level"),
		does_not_start_at_top: t("does not start at h2"),
		skipped_level: t("skipped level"),
	};

	const findings = result.findings.map((finding, index) => {
		return {
			...finding,
			// A field can raise several findings on the same block, so include the index for a stable key.
			id: `${finding.contentBlockId}:${finding.kind}:${String(finding.level)}:${String(index)}`,
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
				aria-label={t("Heading hierarchy")}
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
			>
				<TableHeader>
					<TableColumn id="entity" isRowHeader={true}>
						{t("Entity")}
					</TableColumn>
					<TableColumn id="type">{t("Type")}</TableColumn>
					<TableColumn id="field">{t("Field")}</TableColumn>
					<TableColumn id="heading">{t("Heading")}</TableColumn>
					<TableColumn id="detail">{t("Detail")}</TableColumn>
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
							entityType: finding.entityType,
							slug: finding.entitySlug,
						});
						const label = finding.entityLabel ?? finding.entitySlug;

						return (
							<TableRow id={finding.id}>
								<TableCell>
									{href != null ? (
										<Link className="underline" href={href}>
											{label}
										</Link>
									) : (
										label
									)}
								</TableCell>
								<TableCell>{humanizeType(finding.entityType)}</TableCell>
								<TableCell>{humanizeType(finding.fieldName)}</TableCell>
								<TableCell>
									<div className="flex flex-col items-start gap-y-1">
										<Badge intent="secondary">{`h${String(finding.level)}`}</Badge>
										{finding.headingText !== "" ? (
											<span className="block whitespace-normal text-muted-fg max-inline-64">
												{finding.headingText}
											</span>
										) : null}
										<Badge intent={findingKindBadgeIntents[finding.kind]}>
											{findingKindLabels[finding.kind]}
										</Badge>
									</div>
								</TableCell>
								<TableCell>
									<span className="block whitespace-normal max-inline-96">{finding.detail}</span>
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
