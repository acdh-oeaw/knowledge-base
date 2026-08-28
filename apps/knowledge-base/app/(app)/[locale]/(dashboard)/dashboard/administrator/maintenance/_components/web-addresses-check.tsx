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
import type { WebAddressCheckResult, WebAddressFindingKind } from "@/lib/data/data-integrity";
import { getEntityDetailHref } from "@/lib/entity-detail-href";

interface WebAddressesCheckProps {
	result: WebAddressCheckResult;
}

const findingKindBadgeIntents: Record<WebAddressFindingKind, "amber" | "rose"> = {
	insecure_scheme: "amber",
	invalid: "rose",
};

export function WebAddressesCheck(props: Readonly<WebAddressesCheckProps>): ReactNode {
	const { result } = props;

	const t = useExtracted();

	const findingKindLabels: Record<WebAddressFindingKind, string> = {
		insecure_scheme: t("insecure (http)"),
		invalid: t("invalid"),
	};

	const findings = result.findings.map((finding, index) => {
		return {
			...finding,
			// A record can appear more than once (e.g. draft and published), so include the index for a
			// stable key.
			id: `${finding.source}:${finding.entitySlug ?? finding.socialMediaId ?? finding.workingGroupReportId ?? finding.recordLabel}:${String(index)}`,
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
				aria-label={t("Web addresses")}
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
			>
				<TableHeader>
					<TableColumn id="record" isRowHeader={true}>
						{t("Record")}
					</TableColumn>
					<TableColumn id="source">{t("Source")}</TableColumn>
					<TableColumn id="value">{t("Value")}</TableColumn>
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
						const href =
							finding.socialMediaId != null
								? `/dashboard/administrator/social-media/${finding.socialMediaId}/edit`
								: // Reports are not entities, so they are linked by id — straight to the step the
									// value lives on, which for an event url is the report's events form.
									finding.workingGroupReportId != null
									? `/dashboard/administrator/working-group-reports/${finding.workingGroupReportId}/edit/events`
									: finding.entityType != null && finding.entitySlug != null
										? getEntityDetailHref({
												entityType: finding.entityType,
												slug: finding.entitySlug,
											})
										: null;

						return (
							<TableRow id={finding.id}>
								<TableCell>
									<div className="flex flex-col items-start gap-y-1 min-inline-0">
										<div className="truncate max-inline-80" title={finding.recordLabel}>
											{href != null ? (
												<Link className="underline" href={href}>
													{finding.recordLabel}
												</Link>
											) : (
												finding.recordLabel
											)}
										</div>
										{finding.status != null ? (
											<Badge intent="secondary">{finding.status}</Badge>
										) : null}
									</div>
								</TableCell>
								<TableCell>{finding.sourceLabel}</TableCell>
								<TableCell>
									<div className="flex flex-col items-start gap-y-1">
										<span className="block font-mono text-xs break-all whitespace-normal max-inline-96">
											{finding.value}
										</span>
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
