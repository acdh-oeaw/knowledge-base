import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { AssetsPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_components/assets-page";
import { imageGridOptions } from "@/config/assets.config";
import { dashboardPageSize } from "@/config/pagination.config";
import { type AssetPrefix, assetPrefixes } from "@/lib/data/assets";
import { getAssetsForDashboard } from "@/lib/data/cached/assets";
import { getLicenseOptions } from "@/lib/data/licenses";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";
import { getListSearchParams, getSearchParam } from "@/lib/server/list-search-params";

interface DashboardWebsiteAssetsPageProps extends PageProps<"/[locale]/dashboard/website/assets"> {}

const pageSize = dashboardPageSize;

function createListHref(q: string, prefix: string, page: number): string {
	const searchParams = new URLSearchParams();

	if (q !== "") {
		searchParams.set("q", q);
	}

	if (prefix !== "") {
		searchParams.set("prefix", prefix);
	}

	if (page > 1) {
		searchParams.set("page", String(page));
	}

	const query = searchParams.toString();

	return `/dashboard/website/assets${query !== "" ? `?${query}` : ""}`;
}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteAssetsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Assets"),
	});

	return metadata;
}

export default async function DashboardWebsiteAssetsPage(
	props: Readonly<DashboardWebsiteAssetsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams } = props;
	const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);
	const { page, q } = getListSearchParams(rawSearchParams);
	const rawPrefix = getSearchParam(rawSearchParams, "prefix") ?? "";
	const prefix = assetPrefixes.includes(rawPrefix as AssetPrefix)
		? (rawPrefix as AssetPrefix)
		: undefined;
	const [assets, licenses] = await Promise.all([
		getAssetsForDashboard({
			imageUrlOptions: imageGridOptions,
			limit: pageSize,
			offset: (page - 1) * pageSize,
			prefix,
			q,
		}),
		getLicenseOptions(),
	]);
	const totalPages = Math.max(Math.ceil(assets.total / pageSize), 1);

	if (page > totalPages) {
		redirect({
			href: createListHref(q, prefix ?? "", totalPages),
			locale: locale as IntlLocale,
		});
	}

	return <AssetsPage assets={assets} licenses={licenses} page={page} prefix={prefix ?? ""} q={q} />;
}
