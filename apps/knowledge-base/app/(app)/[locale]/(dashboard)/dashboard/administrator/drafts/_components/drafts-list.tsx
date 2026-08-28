"use client";

import { Badge } from "@dariah-eric/ui/badge";
import { EmptyState } from "@dariah-eric/ui/empty-state";
import { Link } from "@dariah-eric/ui/link";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode, useMemo, useState } from "react";

import { EntityListHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { Paginate } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/paginate";
import { useClientTable } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-client-table";
import type { DraftDocument } from "@/lib/data/draft-documents";
import { getEntityDetailHref } from "@/lib/entity-detail-href";

interface DraftsListProps {
	drafts: Array<DraftDocument>;
}

function humanize(value: string): string {
	return value.replaceAll("_", " ");
}

/** The type shown/filtered/sorted on: the org-unit subtype for units, otherwise the entity type. */
function draftType(draft: DraftDocument): string {
	return draft.unitType ?? draft.entityType;
}

export function DraftsList(props: Readonly<DraftsListProps>): ReactNode {
	const { drafts } = props;

	const t = useExtracted();
	const format = useFormatter();

	const [selectedType, setSelectedType] = useState<string>("all");

	const rows = useMemo(
		() =>
			drafts.map((draft) => {
				return { ...draft, id: draft.documentId };
			}),
		[drafts],
	);

	const typeOptions = useMemo(
		() => Array.from(new Set(drafts.map(draftType))).sort((a, b) => a.localeCompare(b)),
		[drafts],
	);

	const filtered = useMemo(
		() => (selectedType === "all" ? rows : rows.filter((row) => draftType(row) === selectedType)),
		[rows, selectedType],
	);

	const table = useClientTable({
		items: filtered,
		sortAccessors: {
			name: (row) => row.label ?? "",
			type: (row) => humanize(draftType(row)),
			status: (row) => row.state,
			updated: (row) => row.draftUpdatedAt,
		},
	});

	return (
		<Fragment>
			<EntityListHeader
				title={t("Drafts")}
				description={t(
					"Unpublished documents awaiting review — new drafts and changes on top of published versions.",
				)}
			/>

			{rows.length === 0 ? (
				<EmptyState
					description={t("Unpublished documents awaiting review will appear here.")}
					title={t("No drafts awaiting review")}
				/>
			) : (
				<Fragment>
					<div className="mbs-(--layout-padding) flex justify-end">
						<Select
							aria-label={t("Filter by type")}
							onChange={(key) => {
								setSelectedType(String(key));
								table.setPage(1);
							}}
							value={selectedType}
						>
							<SelectTrigger />
							<SelectContent>
								<SelectItem id="all">{t("All types")}</SelectItem>
								{typeOptions.map((type) => (
									<SelectItem key={type} id={type}>
										{humanize(type)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<Table
						aria-label={t("Drafts")}
						className="[--gutter:0] sm:[--gutter:0]"
						onSortChange={table.onSortChange}
						sortDescriptor={table.sortDescriptor}
					>
						<TableHeader>
							<TableColumn
								allowsSorting={true}
								className="max-inline-96"
								id="name"
								isRowHeader={true}
							>
								{t("Name")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="type">
								{t("Type")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="status">
								{t("Status")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="updated">
								{t("Last edited")}
							</TableColumn>
						</TableHeader>
						<TableBody items={table.pageItems}>
							{(draft) => {
								const href = getEntityDetailHref({
									entityType: draft.entityType,
									unitType: draft.unitType,
									slug: draft.slug,
								});
								const label = draft.label ?? t("Untitled");

								return (
									<TableRow id={draft.id}>
										<TableCell>
											{href != null ? (
												<Link className="underline" href={href}>
													{label}
												</Link>
											) : (
												label
											)}
										</TableCell>
										<TableCell>
											<Badge intent="slate">{humanize(draftType(draft))}</Badge>
										</TableCell>
										<TableCell>
											<Badge intent={draft.state === "draft" ? "emerald" : "amber"}>
												{draft.state === "draft" ? t("New draft") : t("Draft changes")}
											</Badge>
										</TableCell>
										<TableCell>
											{draft.draftUpdatedAt != null
												? format.dateTime(draft.draftUpdatedAt, {
														dateStyle: "medium",
														timeStyle: "short",
													})
												: "—"}
										</TableCell>
									</TableRow>
								);
							}}
						</TableBody>
					</Table>

					{table.totalPages > 1 ? (
						<Paginate
							page={table.page}
							setPage={table.setPage}
							total={table.totalPages}
							totalItems={table.total}
						/>
					) : null}
				</Fragment>
			)}
		</Fragment>
	);
}
