import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { NewslettersPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/newsletters/_components/newsletters-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getNewslettersForAdmin } from "@/lib/data/newsletters";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { getListSearchParams } from "@/lib/server/list-search-params";

interface DashboardAdministratorNewslettersPageProps extends PageProps<"/[locale]/dashboard/administrator/newsletters"> {}

const pageSize = dashboardPageSize;

function createListHref(q: string, page: number): string {
	const searchParams = new URLSearchParams();

	if (q !== "") {
		searchParams.set("q", q);
	}

	if (page > 1) {
		searchParams.set("page", String(page));
	}

	const query = searchParams.toString();

	return `/dashboard/administrator/newsletters${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorNewslettersPageProps>,
): Promise<Metadata> {
	const t = await getExtracted();

	return {
		title: t("Administrator dashboard - Newsletters"),
	};
}

export default async function DashboardAdministratorNewslettersPage(
	props: Readonly<DashboardAdministratorNewslettersPageProps>,
): Promise<ReactNode> {
	const { params, searchParams } = props;
	const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
	const { page, q } = getListSearchParams(rawSearchParams);
	const { user } = await assertAuthenticated();
	const newsletters = await getNewslettersForAdmin(user, {
		limit: pageSize,
		offset: (page - 1) * pageSize,
		q,
	});
	const totalPages = Math.max(Math.ceil(newsletters.total / pageSize), 1);

	if (page > totalPages) {
		redirect({ href: createListHref(q, totalPages), locale: locale as IntlLocale });
	}

	return <NewslettersPage newsletters={newsletters} page={page} q={q} />;
}
