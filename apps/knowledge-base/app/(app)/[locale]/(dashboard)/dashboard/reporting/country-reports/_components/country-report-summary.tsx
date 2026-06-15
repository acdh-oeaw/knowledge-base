import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import type { CountryReportSummaryData } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";

export type { CountryReportSummaryData };

interface CountryReportSummaryProps {
	data: CountryReportSummaryData;
}

function formatRole(role: string): string {
	return role
		.replaceAll("_", " ")
		.replace(/^is /, "")
		.replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

function formatKpi(kpi: string): string {
	return kpi.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

const eurFormatter = new Intl.NumberFormat("en", {
	style: "currency",
	currency: "EUR",
	maximumFractionDigits: 0,
});

export async function CountryReportSummary(
	props: Readonly<CountryReportSummaryProps>,
): Promise<ReactNode> {
	const { data } = props;

	const t = await getExtracted();

	const hasEvents =
		data.smallEvents != null ||
		data.mediumEvents != null ||
		data.largeEvents != null ||
		data.veryLargeEvents != null ||
		data.dariahCommissionedEvent != null ||
		data.reusableOutcomes != null;

	return (
		<div className="flex flex-col gap-y-10">
			{data.institutions.length > 0 && (
				<section className="flex flex-col gap-y-4">
					<h2 className="text-sm font-semibold text-fg">{t("Institutions")}</h2>
					<ul className="divide-y rounded-md border">
						{data.institutions.map((inst) => (
							<li key={inst.id} className="px-4 py-3">
								<p className="text-sm font-medium text-fg">
									{inst.name}
									{inst.acronym != null && (
										<span className="ms-2 text-muted-fg">({inst.acronym})</span>
									)}
								</p>
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="flex flex-col gap-y-4">
				<h2 className="text-sm font-semibold text-fg">{t("Contributors")}</h2>
				{data.contributions.length > 0 && (
					<ul className="mbe-4 divide-y rounded-md border">
						{data.contributions.map((c) => (
							<li key={c.id} className="px-4 py-3">
								<p className="text-sm font-medium text-fg">{c.personName}</p>
								<p className="text-xs text-muted-fg">
									{formatRole(c.roleType)}
									{" · "}
									{c.orgUnitName}
								</p>
							</li>
						))}
					</ul>
				)}
				<dl className="grid max-inline-xs grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
					<dt className="text-muted-fg">{t("Total contributors")}</dt>
					<dd>{data.totalContributors ?? "—"}</dd>
				</dl>
			</section>

			{hasEvents && (
				<section className="flex flex-col gap-y-4">
					<h2 className="text-sm font-semibold text-fg">{t("Events")}</h2>
					<dl className="grid max-inline-xs grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
						<dt className="text-muted-fg">{t("Small")}</dt>
						<dd>{data.smallEvents ?? "—"}</dd>
						<dt className="text-muted-fg">{t("Medium")}</dt>
						<dd>{data.mediumEvents ?? "—"}</dd>
						<dt className="text-muted-fg">{t("Large")}</dt>
						<dd>{data.largeEvents ?? "—"}</dd>
						<dt className="text-muted-fg">{t("Very large")}</dt>
						<dd>{data.veryLargeEvents ?? "—"}</dd>
						{data.dariahCommissionedEvent != null && (
							<>
								<dt className="text-muted-fg">{t("DARIAH commissioned event")}</dt>
								<dd>{data.dariahCommissionedEvent}</dd>
							</>
						)}
						{data.reusableOutcomes != null && (
							<>
								<dt className="text-muted-fg">{t("Reusable outcomes")}</dt>
								<dd>{data.reusableOutcomes}</dd>
							</>
						)}
					</dl>
				</section>
			)}

			{data.socialMediaAccounts.length > 0 && (
				<section className="flex flex-col gap-y-6">
					<h2 className="text-sm font-semibold text-fg">{t("Social media")}</h2>
					{data.socialMediaAccounts.map((account) => {
						const nonZeroKpis = account.kpis.filter((k) => k.value > 0);

						return (
							<div key={account.socialMediaId} className="flex flex-col gap-y-3">
								<div className="space-y-0.5">
									<p className="text-sm font-medium text-fg">{account.name}</p>
									<a
										className="text-xs text-muted-fg underline"
										href={account.url}
										rel="noreferrer"
										target="_blank"
									>
										{account.url}
									</a>
								</div>
								{nonZeroKpis.length > 0 ? (
									<dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-4">
										{nonZeroKpis.map((k) => (
											<div key={k.kpi}>
												<dt className="text-xs text-muted-fg">{formatKpi(k.kpi)}</dt>
												<dd className="font-medium">{k.value.toLocaleString()}</dd>
											</div>
										))}
									</dl>
								) : (
									<p className="text-sm text-muted-fg">{t("No KPIs recorded.")}</p>
								)}
							</div>
						);
					})}
				</section>
			)}

			{data.services.length > 0 && (
				<section className="flex flex-col gap-y-6">
					<h2 className="text-sm font-semibold text-fg">{t("Services")}</h2>
					{data.services.map((service) => {
						const nonZeroKpis = service.kpis.filter((k) => k.value > 0);

						return (
							<div key={service.serviceId} className="flex flex-col gap-y-3">
								<p className="text-sm font-medium text-fg">{service.name}</p>
								{nonZeroKpis.length > 0 ? (
									<dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-4">
										{nonZeroKpis.map((k) => (
											<div key={k.kpi}>
												<dt className="text-xs text-muted-fg">{formatKpi(k.kpi)}</dt>
												<dd className="font-medium">{k.value.toLocaleString()}</dd>
											</div>
										))}
									</dl>
								) : (
									<p className="text-sm text-muted-fg">{t("No KPIs recorded.")}</p>
								)}
							</div>
						);
					})}
				</section>
			)}

			{data.projectContributions.length > 0 && (
				<section className="flex flex-col gap-y-4">
					<h2 className="text-sm font-semibold text-fg">{t("Project contributions")}</h2>
					<ul className="divide-y rounded-md border">
						{data.projectContributions.map((p) => (
							<li key={p.id} className="flex items-center justify-between gap-x-4 px-4 py-3">
								<span className="text-sm font-medium text-fg">{p.projectName}</span>
								<span className="shrink-0 text-sm text-muted-fg">
									{eurFormatter.format(p.amountEuros)}
								</span>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
