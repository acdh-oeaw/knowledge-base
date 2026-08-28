import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { PagesPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/pages/_components/pages-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { getPages } from "@/lib/data/cached/pages";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import {
	type ListSortDirection,
	getListSearchParams,
	getListSortSearchParams,
} from "@/lib/server/list-search-params";

interface DashboardWebsitePagesPageProps extends PageProps<"/[locale]/dashboard/website/pages"> {}

const pageSize = dashboardPageSize;
const defaultSort = "publicationDate" as const;
const validSorts = ["publicationDate", "title"] as const;

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

	return `/dashboard/website/pages${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardWebsitePagesPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Pages"),
	});

	return metadata;
}

export default async function DashboardWebsitePagesPage(
	props: Readonly<DashboardWebsitePagesPageProps>,
): Promise<ReactNode> {
	const { params, searchParams } = props;
	const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
	const { page, q } = getListSearchParams(rawSearchParams);
	const { dir, sort } = getListSortSearchParams(rawSearchParams, {
		defaultDir: "desc",
		defaultSort,
		validSorts,
	});
	const pages = await getPages({ limit: pageSize, offset: (page - 1) * pageSize, q, sort, dir });
	const totalPages = Math.max(Math.ceil(pages.total / pageSize), 1);

	if (page > totalPages) {
		redirect({ href: createListHref(q, totalPages, sort, dir), locale: locale as IntlLocale });
	}

	return <PagesPage dir={dir} page={page} pages={pages} q={q} sort={sort} />;
}
