import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { DocumentationPagesPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_components/documentation-pages-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { getDocumentationPages } from "@/lib/data/cached/documentation-pages";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import {
	type ListSortDirection,
	getListSearchParams,
	getListSortSearchParams,
} from "@/lib/server/list-search-params";

interface DashboardAdministratorDocumentationPagesPageProps extends PageProps<"/[locale]/dashboard/administrator/documentation-pages"> {}

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

	return `/dashboard/website/documentation-pages${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorDocumentationPagesPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Documentation pages"),
	});
}

export default async function DashboardAdministratorDocumentationPagesPage(
	props: Readonly<DashboardAdministratorDocumentationPagesPageProps>,
): Promise<ReactNode> {
	const { params, searchParams } = props;
	const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
	const { page, q } = getListSearchParams(rawSearchParams);
	const { dir, sort } = getListSortSearchParams(rawSearchParams, {
		defaultDir: "desc",
		defaultSort,
		validSorts,
	});
	const documentationPages = await getDocumentationPages({
		limit: pageSize,
		offset: (page - 1) * pageSize,
		q,
		sort,
		dir,
	});
	const totalPages = Math.max(Math.ceil(documentationPages.total / pageSize), 1);

	if (page > totalPages) {
		redirect({
			href: createListHref(q, totalPages, sort, dir),
			locale: locale as IntlLocale,
		});
	}

	return (
		<DocumentationPagesPage
			dir={dir}
			documentationPages={documentationPages}
			page={page}
			q={q}
			sort={sort}
		/>
	);
}
