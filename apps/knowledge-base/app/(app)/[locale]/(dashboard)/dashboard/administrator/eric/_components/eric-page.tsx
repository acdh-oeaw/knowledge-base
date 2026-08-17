"use client";

import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import { EyeIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import { EntityLifecycleStatusBadge } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-status-badge";
import {
	EntityListHeader,
	RowActionsMenu,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import type { EricForAdmin } from "@/lib/data/eric";

interface EricPageProps {
	eric: EricForAdmin;
}

export function EricPage(props: Readonly<EricPageProps>): ReactNode {
	const { eric } = props;

	const t = useExtracted();

	const detailsHref = `/dashboard/administrator/eric/${eric.slug}/details`;
	const editHref = `/dashboard/administrator/eric/${eric.slug}/edit`;

	return (
		<>
			<EntityListHeader
				title={t("DARIAH ERIC")}
				description={t("Manage DARIAH ERIC and its member and partner relations.")}
			/>

			<Table
				aria-label="eric"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
			>
				<TableHeader>
					<TableColumn isRowHeader={true}>{t("Name")}</TableColumn>
					<TableColumn>{t("Status")}</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
				</TableHeader>
				<TableBody>
					<TableRow href={detailsHref}>
						<TableCell>{eric.name}</TableCell>
						<TableCell>
							<EntityLifecycleStatusBadge hasDraft={eric.hasDraft} isPublished={eric.isPublished} />
						</TableCell>
						<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
							<RowActionsMenu>
								<RowActionsMenu.Link
									href={detailsHref}
									icon={<EyeIcon className="me-2 block-4 inline-4" />}
								>
									{t("View")}
								</RowActionsMenu.Link>
								<RowActionsMenu.Link
									href={editHref}
									icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
								>
									{t("Edit")}
								</RowActionsMenu.Link>
							</RowActionsMenu>
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</>
	);
}
