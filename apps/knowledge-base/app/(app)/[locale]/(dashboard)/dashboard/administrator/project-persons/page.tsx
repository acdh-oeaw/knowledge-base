import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ProjectPersonsPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-persons/_components/project-persons-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getProjectPersonsForAdmin } from "@/lib/data/project-persons";
import { db } from "@/lib/db";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import {
	type ListSortDirection,
	getListSearchParams,
	getListSortSearchParams,
} from "@/lib/server/list-search-params";

interface DashboardAdministratorProjectPersonsPageProps extends PageProps<"/[locale]/dashboard/administrator/project-persons"> {}

const pageSize = dashboardPageSize;
const defaultSort = "projectName" as const;
const validSorts = [
	"projectName",
	"roleType",
	"personName",
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

	return `/dashboard/administrator/project-persons${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorProjectPersonsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Project persons"),
	});

	return metadata;
}

export default async function DashboardAdministratorProjectPersonsPage(
	props: Readonly<DashboardAdministratorProjectPersonsPageProps>,
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
	const [projectPersons, roles] = await Promise.all([
		getProjectPersonsForAdmin(user, {
			limit: pageSize,
			offset: (page - 1) * pageSize,
			q,
			sort,
			dir,
		}),
		db.query.projectRoles.findMany({
			orderBy: { role: "asc" },
			columns: { id: true, role: true },
		}),
	]);
	const totalPages = Math.max(Math.ceil(projectPersons.total / pageSize), 1);

	if (page > totalPages) {
		redirect({ href: createListHref(q, totalPages, sort, dir), locale: locale as IntlLocale });
	}

	return (
		<ProjectPersonsPage
			dir={dir}
			page={page}
			projectPersons={projectPersons}
			q={q}
			roles={roles}
			sort={sort}
		/>
	);
}
