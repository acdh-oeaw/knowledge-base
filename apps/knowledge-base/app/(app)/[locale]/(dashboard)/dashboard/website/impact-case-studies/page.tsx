import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ImpactCaseStudiesPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/impact-case-studies/_components/impact-case-studies-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { getImpactCaseStudies } from "@/lib/data/cached/impact-case-studies";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import {
	type ListSortDirection,
	getListSearchParams,
	getListSortSearchParams,
} from "@/lib/server/list-search-params";

interface DashboardWebsiteImpactCaseStudiesPageProps extends PageProps<"/[locale]/dashboard/website/impact-case-studies"> {}

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

	return `/dashboard/website/impact-case-studies${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteImpactCaseStudiesPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Impact case studies"),
	});

	return metadata;
}

export default async function DashboardWebsiteImpactCaseStudiesPage(
	props: Readonly<DashboardWebsiteImpactCaseStudiesPageProps>,
): Promise<ReactNode> {
	const { params, searchParams } = props;
	const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
	const { page, q } = getListSearchParams(rawSearchParams);
	const { dir, sort } = getListSortSearchParams(rawSearchParams, {
		defaultDir: "desc",
		defaultSort,
		validSorts,
	});
	const impactCaseStudies = await getImpactCaseStudies({
		limit: pageSize,
		offset: (page - 1) * pageSize,
		q,
		sort,
		dir,
	});
	const totalPages = Math.max(Math.ceil(impactCaseStudies.total / pageSize), 1);

	if (page > totalPages) {
		redirect({ href: createListHref(q, totalPages, sort, dir), locale: locale as IntlLocale });
	}

	return (
		<ImpactCaseStudiesPage
			dir={dir}
			impactCaseStudies={impactCaseStudies}
			page={page}
			q={q}
			sort={sort}
		/>
	);
}
