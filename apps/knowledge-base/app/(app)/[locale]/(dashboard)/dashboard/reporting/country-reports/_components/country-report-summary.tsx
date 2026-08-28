import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import {
	ReportSummaryNav,
	ReportSummarySection,
	type ReportSummarySectionLink,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-summary-section";
import {
	type CountryReportSummaryData,
	formatContributorOrgUnit,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import {
	type CountryReportInstitutionRepresentation,
	formatCountryReportInstitutionRepresentationType,
} from "@/lib/data/country-report-institutions";

export type { CountryReportSummaryData };

interface CountryReportSummaryProps {
	data: CountryReportSummaryData;
	/**
	 * Additional "On this page" nav links for sections rendered as siblings of this summary (e.g. the
	 * admin "External data snapshots" block). Appended after the stored-data sections.
	 */
	extraSectionLinks?: ReadonlyArray<ReportSummarySectionLink>;
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

function formatInstitutionRelationTypes(
	representationTypes: ReadonlyArray<CountryReportInstitutionRepresentation>,
): string | null {
	if (representationTypes.length === 0) {
		return null;
	}

	return representationTypes
		.map((type) => formatCountryReportInstitutionRepresentationType(type))
		.join(", ");
}

const eurFormatter = new Intl.NumberFormat("en", {
	style: "currency",
	currency: "EUR",
	maximumFractionDigits: 0,
});

function formatOperationalCostLabel(label: string): string {
	const separatorIndex = label.indexOf(": ");
	if (separatorIndex === -1) {
		return label;
	}

	const prefix = label.slice(0, separatorIndex);
	const value = label.slice(separatorIndex + 2);

	return `${prefix}: ${formatRole(value)}`;
}

function formatOperationalCostBucket(bucket: string): string {
	return formatRole(bucket);
}

export async function CountryReportSummary(
	props: Readonly<CountryReportSummaryProps>,
): Promise<ReactNode> {
	const { data, extraSectionLinks } = props;

	const t = await getExtracted();

	const hasEvents =
		data.smallEvents != null ||
		data.mediumEvents != null ||
		data.largeEvents != null ||
		data.veryLargeEvents != null ||
		data.dariahCommissionedEvent != null ||
		data.reusableOutcomes != null;

	const institutionsLabel = t("Institutions");
	const contributorsLabel = t("Contributors");
	const eventsLabel = t("Events");
	const socialMediaLabel = t("Social media");
	const servicesLabel = t("Services");
	const projectContributionsLabel = t("Project contributions");
	const operationalCostLabel = t("Operational cost");

	const sectionLinks: Array<ReportSummarySectionLink> = [
		{ id: "country-report-operational-cost", label: operationalCostLabel },
		{ id: "country-report-contributors", label: contributorsLabel },
		{ id: "country-report-institutions", label: institutionsLabel },
	];

	if (hasEvents) {
		sectionLinks.push({ id: "country-report-events", label: eventsLabel });
	}

	if (data.socialMediaAccounts.length > 0) {
		sectionLinks.push({ id: "country-report-social-media", label: socialMediaLabel });
	}

	if (data.services.length > 0) {
		sectionLinks.push({ id: "country-report-services", label: servicesLabel });
	}

	if (data.projectContributions.length > 0) {
		sectionLinks.push({
			id: "country-report-project-contributions",
			label: projectContributionsLabel,
		});
	}

	if (extraSectionLinks != null) {
		sectionLinks.push(...extraSectionLinks);
	}

	return (
		<div className="flex flex-col gap-y-8 max-inline-4xl">
			<ReportSummaryNav
				aria-label={t("Report sections")}
				links={sectionLinks}
				title={t("On this page")}
			/>

			<div className="flex flex-col">
				<ReportSummarySection
					contentClassName="gap-y-4"
					id="country-report-operational-cost"
					title={operationalCostLabel}
				>
					<div className="rounded-md border border-border">
						<div className="flex items-baseline justify-between gap-x-6 border-be border-border px-4 py-3">
							<span className="text-sm font-medium text-fg">{t("Total operational cost")}</span>
							<span className="text-lg font-semibold text-fg">
								{eurFormatter.format(data.operationalCost.total)}
							</span>
						</div>
						<div className="flex items-baseline justify-between gap-x-6 border-be border-border px-4 py-3">
							<span className="text-sm font-medium text-fg">{t("Operational cost threshold")}</span>
							<span className="text-sm font-medium text-fg">
								{data.operationalCost.threshold == null
									? "—"
									: eurFormatter.format(data.operationalCost.threshold)}
							</span>
						</div>
						{data.operationalCost.lines.length > 0 ? (
							<ul className="divide-y divide-border">
								{data.operationalCost.lines.map((line) => (
									<li
										key={line.key}
										className="grid gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]"
									>
										<span className="font-medium text-fg">
											{formatOperationalCostLabel(line.label)}
										</span>
										{line.bucket != null ? (
											<span className="text-muted-fg sm:col-start-2">
												{t("Bucket")}: {formatOperationalCostBucket(line.bucket)}
											</span>
										) : null}
										{line.showQuantity ? (
											<span className="text-muted-fg sm:col-start-3">
												{t("Quantity")}: {line.quantity.toLocaleString()}
											</span>
										) : null}
										<span className="text-muted-fg sm:col-start-4">
											{t("Unit")}: {eurFormatter.format(line.unitAmount)}
										</span>
										<span className="font-medium text-fg sm:col-start-5 sm:justify-self-end">
											{eurFormatter.format(line.total)}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="px-4 py-3 text-sm text-muted-fg">
								{t("No operational cost line items recorded.")}
							</p>
						)}
					</div>
				</ReportSummarySection>

				<ReportSummarySection id="country-report-contributors" title={contributorsLabel}>
					{data.contributions.length > 0 && (
						<ul className="mbe-4 divide-y rounded-md border">
							{data.contributions.map((c) => (
								<li key={c.id} className="px-4 py-3">
									<p className="text-sm font-medium text-fg">{c.personName}</p>
									<p className="text-xs text-muted-fg">
										{formatRole(c.roleType)}
										{" · "}
										{formatContributorOrgUnit(c.orgUnitName, c.orgUnitType)}
									</p>
								</li>
							))}
						</ul>
					)}
					<dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm max-inline-xs">
						<dt className="text-muted-fg">{t("Total contributors")}</dt>
						<dd>{data.totalContributors ?? "—"}</dd>
					</dl>
				</ReportSummarySection>

				<ReportSummarySection
					contentClassName="gap-y-4"
					id="country-report-institutions"
					title={institutionsLabel}
				>
					{data.institutions.length > 0 && (
						<ul className="divide-y rounded-md border">
							{data.institutions.map((institution) => {
								const representationTypes = formatInstitutionRelationTypes(
									institution.representationTypes,
								);

								return (
									<li key={institution.id} className="px-4 py-3">
										<p className="text-sm font-medium text-fg">
											{institution.name}
											{institution.acronym != null && (
												<span className="ms-2 text-muted-fg">({institution.acronym})</span>
											)}
										</p>
										{representationTypes != null && (
											<p className="text-xs text-muted-fg">{representationTypes}</p>
										)}
									</li>
								);
							})}
						</ul>
					)}
					<dl className="grid grid-cols-[auto_1fr] gap-x-8 text-sm max-inline-xs">
						<dt className="text-muted-fg">{t("Number of institutions")}</dt>
						<dd>{data.institutions.length.toLocaleString()}</dd>
					</dl>
				</ReportSummarySection>

				{hasEvents && (
					<ReportSummarySection id="country-report-events" title={eventsLabel}>
						<dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
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
					</ReportSummarySection>
				)}

				{data.socialMediaAccounts.length > 0 && (
					<ReportSummarySection
						contentClassName="gap-y-3"
						id="country-report-social-media"
						title={socialMediaLabel}
					>
						{data.socialMediaAccounts.map((account) => {
							const nonZeroKpis = account.kpis.filter((k) => k.value > 0);

							return (
								<div
									key={account.socialMediaId}
									className="flex flex-col gap-y-3 rounded-md border border-border p-4"
								>
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
					</ReportSummarySection>
				)}

				{data.services.length > 0 && (
					<ReportSummarySection
						contentClassName="gap-y-3"
						id="country-report-services"
						title={servicesLabel}
					>
						{data.services.map((service) => {
							const nonZeroKpis = service.kpis.filter((k) => k.value > 0);

							return (
								<div
									key={service.serviceId}
									className="flex flex-col gap-y-3 rounded-md border border-border p-4"
								>
									<div className="flex items-baseline justify-between gap-x-4">
										<p className="text-sm font-medium text-fg">{service.name}</p>
										{service.costBucket != null ? (
											<p className="shrink-0 text-xs text-muted-fg">
												{t("Bucket")}: {formatOperationalCostBucket(service.costBucket)}
											</p>
										) : null}
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
					</ReportSummarySection>
				)}

				{data.projectContributions.length > 0 && (
					<ReportSummarySection
						id="country-report-project-contributions"
						title={projectContributionsLabel}
					>
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
					</ReportSummarySection>
				)}
			</div>
		</div>
	);
}
