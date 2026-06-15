import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { InternalPagesPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_components/internal-pages-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { getInternalPages } from "@/lib/data/cached/internal-pages";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import {
	type ListSortDirection,
	getListSearchParams,
	getListSortSearchParams,
} from "@/lib/server/list-search-params";

interface DashboardAdministratorInternalPagesPageProps extends PageProps<"/[locale]/dashboard/administrator/internal-pages"> {}

const pageSize = dashboardPageSize;
const defaultSort = "updatedAt" as const;
const validSorts = ["title", "updatedAt"] as const;

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

	return `/dashboard/administrator/internal-pages${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorInternalPagesPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Internal pages"),
	});
}

export default async function DashboardAdministratorInternalPagesPage(
	props: Readonly<DashboardAdministratorInternalPagesPageProps>,
): Promise<ReactNode> {
	const { params, searchParams } = props;
	const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
	const { page, q } = getListSearchParams(rawSearchParams);
	const { dir, sort } = getListSortSearchParams(rawSearchParams, {
		defaultDir: "desc",
		defaultSort,
		validSorts,
	});
	const internalPages = await getInternalPages({
		limit: pageSize,
		offset: (page - 1) * pageSize,
		q,
		sort,
		dir,
	});
	const totalPages = Math.max(Math.ceil(internalPages.total / pageSize), 1);

	if (page > totalPages) {
		redirect({
			href: createListHref(q, totalPages, sort, dir),
			locale: locale as IntlLocale,
		});
	}

	return (
		<InternalPagesPage dir={dir} internalPages={internalPages} page={page} q={q} sort={sort} />
	);
}
