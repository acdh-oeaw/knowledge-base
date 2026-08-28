"use client";

import { Button } from "@dariah-eric/ui/button";
import { Label } from "@dariah-eric/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { useExtracted } from "next-intl";
import { type ReactNode, useOptimistic, useTransition } from "react";
import { RouterProvider as AriaRouterProvider, type Key } from "react-aria-components";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { LoadingDots } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/loading-dots";
import {
	type StatisticsFilterValues,
	statisticsFilterKeys,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_lib/statistics-filters";
import {
	type ReportStep,
	ReportStepTabs,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-step-tabs";
import type { ReportingStatisticsFilterOptions } from "@/lib/data/admin-reporting";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation/navigation";

const basePath = "/dashboard/administrator/reporting-statistics";

/**
 * Sentinel `Select` key for the "no filter" option. React Aria's `Select` needs a non-null key for
 * every option, but "all" is represented by an _absent_ search param. The sentinel is converted
 * away at the search-param boundary (see `applyFilters` and `toSelectedKey`) and is never written
 * to the URL, so it cannot collide with a real campaign year or country name.
 */
const ALL_OPTION = "__all__";

function toSelectedKey(value: string): Key {
	return value === "" ? ALL_OPTION : value;
}

function fromSelectedKey(key: Key | null): string {
	return key == null || key === ALL_OPTION ? "" : String(key);
}

interface ReportingStatisticsShellProps {
	children: ReactNode;
	filterOptions: ReportingStatisticsFilterOptions;
}

/**
 * Chrome shared by every reporting-statistics tab: the section header, the routed tab bar, and the
 * campaign-year/country/status filters.
 *
 * Each page renders this itself rather than it living in a `layout.tsx` for the section. A layout
 * here looked tidier, but an async layout re-suspends on every search-param navigation, and the
 * nearest boundary above it is `dashboard/loading.tsx` — so changing a filter blanked the header,
 * the tabs, and the very select the reader had just used. The sibling list screens have no layout
 * of their own and never flashed; this follows them. The cost is that the chrome re-renders on a
 * tab switch, which is invisible because its state comes from the URL either way.
 *
 * Filter state is read from and written to the URL, so a filtered view is shareable as a link and
 * the server pages parse the very same params to fetch their data.
 */
export function ReportingStatisticsShell(
	props: Readonly<ReportingStatisticsShellProps>,
): ReactNode {
	const { children, filterOptions } = props;

	const t = useExtracted();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();

	const filters: StatisticsFilterValues = {
		campaignYear: searchParams.get("campaignYear") ?? "",
		country: searchParams.get("country") ?? "",
		status: searchParams.get("status") ?? "",
	};
	const [optimisticFilters, setOptimisticFilters] = useOptimistic(filters);
	/**
	 * The tab a switch is heading for, or `null` when none is in flight. Passthrough `null` means
	 * React drops it again as soon as the navigation commits and `pathname` tells the truth.
	 */
	const [pendingPath, setPendingPath] = useOptimistic<string | null>(null);

	/**
	 * Carry the shared filters across a tab switch, but nothing tab-local.
	 *
	 * Paging and sorting are dropped because they mean different things per tab. So is the KPI
	 * filter: services and social media report different categories, so carrying "followers" onto the
	 * services tab would filter it down to nothing that exists.
	 */
	function toTabHref(path: string): string {
		const params = new URLSearchParams();

		for (const key of statisticsFilterKeys) {
			const value = searchParams.get(key);

			if (value != null && value !== "") {
				params.set(key, value);
			}
		}

		const query = params.toString();

		return query === "" ? path : `${path}?${query}`;
	}

	const steps: Array<ReportStep> = [
		{ href: toTabHref(basePath), label: t("Overview"), path: basePath },
		{
			href: toTabHref(`${basePath}/projects`),
			label: t("Projects"),
			path: `${basePath}/projects`,
		},
		{
			href: toTabHref(`${basePath}/services`),
			label: t("Services"),
			path: `${basePath}/services`,
		},
		{
			href: toTabHref(`${basePath}/social-media`),
			label: t("Social media"),
			path: `${basePath}/social-media`,
		},
	];

	/**
	 * Run a tab switch through the same transition the filters use, so the pending badge and the
	 * dimmed results report it exactly as they report a filter change. Without this the tab's own
	 * navigation is not a transition this component can see, and a slow tab sat there looking idle.
	 *
	 * React-aria drives tab-link navigation through the nearest `navigate` (it `preventDefault`s the
	 * native click), so wrapping the provider around the tab bar is the one chokepoint. Scoping it to
	 * the tabs leaves every other link on the page alone.
	 */
	function navigateToTab(...args: Parameters<typeof router.push>): void {
		const [href] = args;
		// react-aria hands `navigate` a plain string; the object form is next-intl's typed-href API.
		const path = typeof href === "string" ? href.split("?")[0] : href.pathname;

		startTransition(() => {
			// Select the clicked tab right away; the pathname only catches up when the route commits.
			setPendingPath(path ?? null);
			router.push(...args);
		});
	}

	/** Sync the filters to the search params, refetching the active tab's data server-side. */
	function applyFilters(next: StatisticsFilterValues) {
		const params = new URLSearchParams(searchParams.toString());

		for (const key of statisticsFilterKeys) {
			const value = next[key];

			if (value === "") {
				params.delete(key);
			} else {
				params.set(key, value);
			}
		}

		// A narrower filter shrinks the result set, so any page beyond the first is meaningless.
		params.delete("page");

		const query = params.toString();

		startTransition(() => {
			// Reflect the choice in the selects immediately; React resets this to the URL-derived
			// `filters` once the navigation settles.
			setOptimisticFilters(next);
			router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
		});
	}

	const hasFilters =
		optimisticFilters.campaignYear !== "" ||
		optimisticFilters.country !== "" ||
		optimisticFilters.status !== "";

	return (
		<div className="flex flex-col gap-y-8">
			<Header>
				<HeaderContent>
					<HeaderTitle>{t("Statistics")}</HeaderTitle>
					<HeaderDescription>
						{t(
							"Review aggregate reporting data across campaigns and compare country-level changes over time.",
						)}
					</HeaderDescription>
				</HeaderContent>
			</Header>

			<div className="flex flex-col gap-y-8 px-(--layout-padding)">
				<AriaRouterProvider navigate={navigateToTab}>
					<ReportStepTabs
						aria-label={t("Statistics views")}
						pendingPath={pendingPath}
						steps={steps}
					/>
				</AriaRouterProvider>

				<section className="rounded-lg border bg-bg p-4">
					<div className="grid gap-4 md:grid-cols-[minmax(0,12rem)_minmax(0,16rem)_minmax(0,12rem)_auto]">
						<Select
							onChange={(key) => {
								applyFilters({ ...optimisticFilters, campaignYear: fromSelectedKey(key) });
							}}
							value={toSelectedKey(optimisticFilters.campaignYear)}
						>
							<Label>{t("Campaign year")}</Label>
							<SelectTrigger />
							<SelectContent>
								<SelectItem id={ALL_OPTION}>{t("All years")}</SelectItem>
								{filterOptions.campaignYears.map((year) => (
									<SelectItem key={year} id={String(year)}>
										{String(year)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							onChange={(key) => {
								applyFilters({ ...optimisticFilters, country: fromSelectedKey(key) });
							}}
							value={toSelectedKey(optimisticFilters.country)}
						>
							<Label>{t("Country")}</Label>
							<SelectTrigger />
							<SelectContent>
								<SelectItem id={ALL_OPTION}>{t("All countries")}</SelectItem>
								{filterOptions.countries.map((country) => (
									<SelectItem key={country} id={country}>
										{country}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							onChange={(key) => {
								applyFilters({ ...optimisticFilters, status: fromSelectedKey(key) });
							}}
							value={toSelectedKey(optimisticFilters.status)}
						>
							<Label>{t("Report status")}</Label>
							<SelectTrigger />
							<SelectContent>
								<SelectItem id={ALL_OPTION}>{t("All statuses")}</SelectItem>
								<SelectItem id="draft">{t("Draft")}</SelectItem>
								<SelectItem id="submitted">{t("Submitted")}</SelectItem>
								<SelectItem id="accepted">{t("Accepted")}</SelectItem>
							</SelectContent>
						</Select>

						<div className="flex items-end">
							<Button
								intent="outline"
								isDisabled={!hasFilters}
								onPress={() => {
									applyFilters({ campaignYear: "", country: "", status: "" });
								}}
							>
								{t("Reset")}
							</Button>
						</div>
					</div>
				</section>

				{/* Visually hidden, polite status region announces the refetch to assistive tech. */}
				<p className="sr-only" role="status">
					{isPending ? t("Loading results…") : ""}
				</p>

				{/*
				 * Dim the results while the new data is fetched, whether that fetch was started by a
				 * filter or by a tab switch. The fade only kicks in after a short delay so a quick
				 * response never flashes; on the way back the delay is 0 so it snaps to full opacity
				 * immediately.
				 */}
				<div
					className={
						isPending
							? "flex flex-col gap-y-10 opacity-60 transition-opacity delay-300 duration-200"
							: "flex flex-col gap-y-10 opacity-100 transition-opacity duration-200"
					}
				>
					{children}
				</div>
			</div>

			{/*
			 * Fixed so it stays visible when the reader has scrolled into a long table. Kept mounted and
			 * faded rather than conditionally rendered, so the same 300ms delay that governs the dimming
			 * suppresses it entirely for a fast response.
			 */}
			<div
				aria-hidden={true}
				className={
					isPending
						? "pointer-events-none fixed inset-e-6 inset-be-6 z-20 flex items-center gap-x-2 rounded-full border bg-overlay px-3 py-2 text-xs text-muted-fg opacity-100 shadow-md transition-opacity delay-300 duration-200"
						: "pointer-events-none fixed inset-e-6 inset-be-6 z-20 flex items-center gap-x-2 rounded-full border bg-overlay px-3 py-2 text-xs text-muted-fg opacity-0 shadow-md transition-opacity duration-200"
				}
			>
				<LoadingDots size="small" />
				{t("Updating")}
			</div>
		</div>
	);
}
