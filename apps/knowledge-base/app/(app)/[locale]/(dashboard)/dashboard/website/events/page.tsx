import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { EventsPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_components/events-page";
import { dashboardPageSize } from "@/config/pagination.config";
import { getEvents } from "@/lib/data/cached/events";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import {
	type ListSortDirection,
	getListSearchParams,
	getListSortSearchParams,
} from "@/lib/server/list-search-params";

interface DashboardWebsiteEventsPageProps extends PageProps<"/[locale]/dashboard/website/events"> {}

const pageSize = dashboardPageSize;
const defaultSort = "duration" as const;
const validSorts = ["duration", "title"] as const;

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

	return `/dashboard/website/events${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteEventsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Events"),
	});

	return metadata;
}

export default async function DashboardWebsiteEventsPage(
	props: Readonly<DashboardWebsiteEventsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams } = props;
	const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
	const { page, q } = getListSearchParams(rawSearchParams);
	const { dir, sort } = getListSortSearchParams(rawSearchParams, {
		defaultDir: "desc",
		defaultSort,
		validSorts,
	});
	const events = await getEvents({ limit: pageSize, offset: (page - 1) * pageSize, q, sort, dir });
	const totalPages = Math.max(Math.ceil(events.total / pageSize), 1);

	if (page > totalPages) {
		redirect({ href: createListHref(q, totalPages, sort, dir), locale: locale as IntlLocale });
	}

	return <EventsPage dir={dir} events={events} page={page} q={q} sort={sort} />;
}
