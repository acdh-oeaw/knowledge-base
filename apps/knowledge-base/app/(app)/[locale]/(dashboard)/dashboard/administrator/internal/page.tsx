import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { InternalDashboard } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal/_components/internal-dashboard";
import { dashboardPageSize } from "@/config/pagination.config";
import { assertAdminPageAccess } from "@/lib/auth/session";
import { type AuditLogAction, auditLogActions, getAuditLogEntries } from "@/lib/data/audit-log";
import { getExpensiveStatements } from "@/lib/data/pg-stat-statements";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import { getListSearchParams, getSearchParam } from "@/lib/server/list-search-params";

interface DashboardAdministratorInternalPageProps extends PageProps<"/[locale]/dashboard/administrator/internal"> {}

const pageSize = dashboardPageSize;

function createListHref(page: number, action: AuditLogAction | undefined, q: string): string {
	const searchParams = new URLSearchParams();

	if (q !== "") {
		searchParams.set("q", q);
	}

	if (action != null) {
		searchParams.set("action", action);
	}

	if (page > 1) {
		searchParams.set("page", String(page));
	}

	const query = searchParams.toString();

	return `/dashboard/administrator/internal${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorInternalPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Internal"),
	});

	return metadata;
}

export default async function DashboardAdministratorInternalPage(
	props: Readonly<DashboardAdministratorInternalPageProps>,
): Promise<ReactNode> {
	const { params, searchParams } = props;
	const [{ locale }, rawSearchParams] = await Promise.all([
		params,
		searchParams,
		assertAdminPageAccess(),
	]);

	const { page, q } = getListSearchParams(rawSearchParams);
	const rawAction = getSearchParam(rawSearchParams, "action");
	const action = auditLogActions.find((value) => value === rawAction);

	const [auditLog, statements] = await Promise.all([
		getAuditLogEntries({ limit: pageSize, offset: (page - 1) * pageSize, action, q }),
		getExpensiveStatements(),
	]);

	const totalPages = Math.max(Math.ceil(auditLog.total / pageSize), 1);

	if (page > totalPages) {
		redirect({ href: createListHref(totalPages, action, q), locale: locale as IntlLocale });
	}

	return (
		<InternalDashboard
			action={action}
			auditLog={auditLog}
			page={page}
			q={q}
			statements={statements}
		/>
	);
}
