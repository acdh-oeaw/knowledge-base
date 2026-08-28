"use client";

import type * as schema from "@dariah-eric/database/schema";
import { Badge } from "@dariah-eric/ui/badge";
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
import { Fragment, type ReactNode, useOptimistic } from "react";

import {
	EntityListHeader,
	EntityListPagination,
	EntityListSearchField,
	RowActionsMenu,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { dashboardPageSize } from "@/config/pagination.config";
import { getServiceStatusLabel } from "@/lib/service-status-label";

interface ServicesPageProps {
	dir: "asc" | "desc";
	page: number;
	q: string;
	services: {
		data: Array<
			Pick<schema.Service, "id" | "name" | "sshocMarketplaceId"> & {
				status: Pick<schema.ServiceStatus, "status">;
				type: Pick<schema.ServiceType, "type">;
			}
		>;
		total: number;
	};
	sort: "name" | "type" | "status" | "sshocMarketplaceId";
}

function statusIntent(status: string): "success" | "warning" | "danger" | "info" {
	switch (status) {
		case "live": {
			return "success";
		}
		case "needs_review": {
			return "warning";
		}
		case "discontinued": {
			return "danger";
		}
		case "to_be_discontinued": {
			return "warning";
		}
		default: {
			return "info";
		}
	}
}

const pageSize = dashboardPageSize;

export function ServicesPage(props: Readonly<ServicesPageProps>): ReactNode {
	const { dir: initialDir, page: initialPage, q: initialQ, services, sort: initialSort } = props;

	const t = useExtracted();
	const [items] = useOptimistic(services.data, (state, id: string) =>
		state.filter((item) => item.id !== id),
	);
	const search = useUrlPaginatedSearch({
		dir: initialDir,
		page: initialPage,
		q: initialQ,
		sort: initialSort,
	});

	return (
		<Fragment>
			<EntityListHeader
				title={t("Services")}
				description={t("Manage all SSHOC services in the DARIAH knowledge base.")}
				action={<EntityListSearchField search={search} />}
			/>

			<Table
				aria-label="services"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn allowsSorting={true} id="name" isRowHeader={true}>
						{t("Name")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="type">
						{t("Type")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="status">
						{t("Status")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="sshocMarketplaceId">
						{t("SSHOC ID")}
					</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow href={`/dashboard/administrator/sshoc-services/${item.id}/view`} id={item.id}>
							<TableCell>{item.name}</TableCell>
							<TableCell>{item.type.type}</TableCell>
							<TableCell>
								<Badge intent={statusIntent(item.status.status)}>
									{getServiceStatusLabel(item.status.status)}
								</Badge>
							</TableCell>
							<TableCell>{item.sshocMarketplaceId ?? "—"}</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end">
								<RowActionsMenu>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/sshoc-services/${item.id}/view`}
										icon={<EyeIcon className="me-2 block-4 inline-4" />}
									>
										{t("View")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/sshoc-services/${item.id}/edit`}
										icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
									>
										{t("Edit")}
									</RowActionsMenu.Link>
								</RowActionsMenu>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			<EntityListPagination search={search} total={services.total} pageSize={pageSize} />
		</Fragment>
	);
}
