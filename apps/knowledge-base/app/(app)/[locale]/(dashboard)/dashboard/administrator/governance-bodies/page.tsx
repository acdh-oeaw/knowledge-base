import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { GovernanceBodiesPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/governance-bodies/_components/governance-bodies-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getGovernanceBodiesForAdmin } from "@/lib/data/cached/governance-bodies";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import {
	type ListSortDirection,
	getListSearchParams,
	getListSortSearchParams,
} from "@/lib/server/list-search-params";

interface DashboardAdministratorGovernanceBodiesPageProps extends PageProps<"/[locale]/dashboard/administrator/governance-bodies"> {}

const pageSize = dashboardPageSize;
const defaultSort = "name" as const;
const validSorts = ["acronym", "name"] as const;

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

	if (sort !== defaultSort || dir !== "asc") {
		searchParams.set("sort", sort);
		searchParams.set("dir", dir);
	}

	const query = searchParams.toString();

	return `/dashboard/administrator/governance-bodies${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorGovernanceBodiesPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Governance bodies"),
	});

	return metadata;
}

export default async function DashboardAdministratorGovernanceBodiesPage(
	props: Readonly<DashboardAdministratorGovernanceBodiesPageProps>,
): Promise<ReactNode> {
	const { params, searchParams } = props;
	const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
	const { page, q } = getListSearchParams(rawSearchParams);
	const { dir, sort } = getListSortSearchParams(rawSearchParams, {
		defaultDir: "asc",
		defaultSort,
		validSorts,
	});
	const { user } = await assertAuthenticated();
	const governanceBodies = await getGovernanceBodiesForAdmin(user, {
		limit: pageSize,
		offset: (page - 1) * pageSize,
		q,
		sort,
		dir,
	});
	const totalPages = Math.max(Math.ceil(governanceBodies.total / pageSize), 1);

	if (page > totalPages) {
		redirect({ href: createListHref(q, totalPages, sort, dir), locale: locale as IntlLocale });
	}

	return (
		<GovernanceBodiesPage
			dir={dir}
			governanceBodies={governanceBodies}
			page={page}
			q={q}
			sort={sort}
		/>
	);
}
