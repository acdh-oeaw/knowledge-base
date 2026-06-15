import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ContributionsPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/contributions/_components/contributions-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getContributionRoleOptions, getContributionsForAdmin } from "@/lib/data/contributions";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import {
	type ListSortDirection,
	getListSearchParams,
	getListSortSearchParams,
} from "@/lib/server/list-search-params";

interface DashboardAdministratorPersonRelationsPageProps extends PageProps<"/[locale]/dashboard/administrator/person-relations"> {}

const pageSize = dashboardPageSize;
const defaultSort = "personName" as const;
const validSorts = [
	"personName",
	"roleType",
	"organisationalUnitType",
	"organisationalUnitName",
	"durationStart",
	"durationEnd",
] as const;

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

	return `/dashboard/administrator/person-relations${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorPersonRelationsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Person relations"),
	});

	return metadata;
}

export default async function DashboardAdministratorPersonRelationsPage(
	props: Readonly<DashboardAdministratorPersonRelationsPageProps>,
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
	const [contributions, roleOptions] = await Promise.all([
		getContributionsForAdmin(user, {
			limit: pageSize,
			offset: (page - 1) * pageSize,
			q,
			sort,
			dir,
		}),
		getContributionRoleOptions(),
	]);
	const totalPages = Math.max(Math.ceil(contributions.total / pageSize), 1);

	if (page > totalPages) {
		redirect({ href: createListHref(q, totalPages, sort, dir), locale: locale as IntlLocale });
	}

	return (
		<ContributionsPage
			contributions={contributions}
			dir={dir}
			page={page}
			q={q}
			roleOptions={roleOptions}
			sort={sort}
		/>
	);
}
