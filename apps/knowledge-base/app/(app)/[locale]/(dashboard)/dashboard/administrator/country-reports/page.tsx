import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportsPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/country-reports/_components/country-reports-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getCountryReportsForAdmin } from "@/lib/data/admin-reporting";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import {
	type ListSortDirection,
	getListSearchParams,
	getListSortSearchParams,
} from "@/lib/server/list-search-params";

interface DashboardAdministratorCountryReportsPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports"> {}

const pageSize = dashboardPageSize;
const defaultSort = "campaignYear" as const;
const validSorts = ["campaignYear", "country"] as const;

function createListHref(
	q: string,
	page: number,
	sort: (typeof validSorts)[number],
	dir: ListSortDirection,
): string {
	const searchParams = new URLSearchParams();

	if (q !== "") {
		searchParams.set("q", q);
	}

	if (page > 1) {
		searchParams.set("page", String(page));
	}

	if (sort !== defaultSort || dir !== "desc") {
		searchParams.set("sort", sort);
		searchParams.set("dir", dir);
	}

	const query = searchParams.toString();

	return `/dashboard/administrator/country-reports${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country reports"),
	});

	return metadata;
}

export default async function DashboardAdministratorCountryReportsPage(
	props: Readonly<DashboardAdministratorCountryReportsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams } = props;
	const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
	const { page, q } = getListSearchParams(rawSearchParams);
	const { dir, sort } = getListSortSearchParams(rawSearchParams, {
		defaultDir: "desc",
		defaultSort,
		validSorts,
	});
	const { user } = await assertAuthenticated();
	const reports = await getCountryReportsForAdmin(user, {
		dir,
		limit: pageSize,
		offset: (page - 1) * pageSize,
		q,
		sort,
	});
	const totalPages = Math.max(Math.ceil(reports.total / pageSize), 1);

	if (page > totalPages) {
		redirect({ href: createListHref(q, totalPages, sort, dir), locale: locale as IntlLocale });
	}

	return <CountryReportsPage dir={dir} page={page} q={q} reports={reports} sort={sort} />;
}
