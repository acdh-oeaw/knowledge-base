import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { InstitutionRelationsPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/institution-relations/_components/institution-relations-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getInstitutionRelationsForAdmin } from "@/lib/data/institution-relations";
import { getUnitRelationStatusOptions } from "@/lib/data/unit-relations";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import {
	type ListSortDirection,
	getListSearchParams,
	getListSortSearchParams,
} from "@/lib/server/list-search-params";

interface DashboardAdministratorInstitutionRelationsPageProps extends PageProps<"/[locale]/dashboard/administrator/institution-relations"> {}

const pageSize = dashboardPageSize;
const defaultSort = "institutionName" as const;
const validSorts = [
	"institutionName",
	"statusType",
	"relatedUnitName",
	"relatedUnitType",
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

	return `/dashboard/administrator/institution-relations${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorInstitutionRelationsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Institution relations"),
	});

	return metadata;
}

export default async function DashboardAdministratorInstitutionRelationsPage(
	props: Readonly<DashboardAdministratorInstitutionRelationsPageProps>,
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
	const [institutionRelations, statusOptions] = await Promise.all([
		getInstitutionRelationsForAdmin(user, {
			limit: pageSize,
			offset: (page - 1) * pageSize,
			q,
			sort,
			dir,
		}),
		getUnitRelationStatusOptions("institution"),
	]);
	const totalPages = Math.max(Math.ceil(institutionRelations.total / pageSize), 1);

	if (page > totalPages) {
		redirect({ href: createListHref(q, totalPages, sort, dir), locale: locale as IntlLocale });
	}

	return (
		<InstitutionRelationsPage
			dir={dir}
			institutionRelations={institutionRelations}
			page={page}
			q={q}
			sort={sort}
			statusOptions={statusOptions}
		/>
	);
}
