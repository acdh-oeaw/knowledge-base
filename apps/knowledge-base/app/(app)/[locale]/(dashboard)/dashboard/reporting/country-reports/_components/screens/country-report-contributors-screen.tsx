import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { CountryReportClaimedContributorsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-claimed-contributors-form";
import { CountryReportContributorsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-contributors-form";
import { CountryReportContributorsSnapshotForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-contributors-snapshot-form";
import { createCountryReportContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/create-country-report-contribution.action";
import { deleteCountryReportContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/delete-country-report-contribution.action";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { refreshCountryReportContributionsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/refresh-country-report-contributions.action";
import { updateCountryReportContributorsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/update-country-report-contributors.action";
import { assertAuthenticated } from "@/lib/auth/session";
import {
	getCountryReportContributions,
	getManualContributionCandidates,
	getSnapshotContributionCandidates,
	isSnapshotRole,
} from "@/lib/data/report-contributions";
import { db } from "@/lib/db";

interface CountryReportContributorsScreenProps {
	reportId: string;
}

/**
 * Shared "contributors" screen rendered by both the reporting flow and the admin tree.
 * Self-authorizes via {@link getAuthorizedCountryReportForUser} (admins pass `can`; others get
 * `notFound`).
 *
 * Two kinds of compensated contributions are handled separately: - Section 1 (snapshot): national
 * coordinator + deputy, bound to the country. Read-only here, edited on the person form; the
 * "refresh" mutation re-captures them from the current relations. - Section 2 (manual):
 * cross-cutting roles (JRC/NCC/working-group chairs, JRC members) that are not inherently tied to a
 * country, so the reporter claims/removes them here. The total-contributors scalar is a separate,
 * manually-entered figure.
 */
export async function CountryReportContributorsScreen(
	props: Readonly<CountryReportContributorsScreenProps>,
): Promise<ReactNode> {
	const { reportId } = props;

	const { user } = await assertAuthenticated();
	const result = await getAuthorizedCountryReportForUser(
		user,
		reportId,
		(id) =>
			db.query.countryReports.findFirst({
				where: { id },
				// countryDocumentId is the country's document id (entities.id), used to match
				// document-level person↔org relations.
				columns: { id: true, totalContributors: true, countryDocumentId: true },
				with: { campaign: { columns: { year: true } } },
			}),
		"update",
	);

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;
	if (report == null) {
		notFound();
	}

	const { year } = report.campaign;

	// The report's stored contributions, resolved to their effective compensation role, split into the
	// country-bound snapshot roles vs the manually-claimed cross-cutting ones.
	const contributions = await getCountryReportContributions(report.id);
	const snapshotContributions = contributions.filter((c) => isSnapshotRole(c.compensationRole));
	const manualContributions = contributions.filter((c) => !isSnapshotRole(c.compensationRole));

	// Section 1 drift: the country's current coordinator/deputy relations for the year.
	const snapshotCandidates = await getSnapshotContributionCandidates(
		report.countryDocumentId,
		year,
	);
	const snapshotCandidateIds = new Set(snapshotCandidates.map((c) => c.personToOrgUnitId));
	const snapshotContributionIds = new Set(snapshotContributions.map((c) => c.personToOrgUnitId));

	const snapshotContributors = snapshotContributions.map((contribution) => {
		return {
			id: contribution.id,
			personName: contribution.personName,
			personSlug: contribution.personSlug,
			compensationRole: contribution.compensationRole,
			isCurrent: snapshotCandidateIds.has(contribution.personToOrgUnitId),
		};
	});
	const missingSnapshotContributors = snapshotCandidates
		.filter((candidate) => !snapshotContributionIds.has(candidate.personToOrgUnitId))
		.map((candidate) => {
			return {
				personToOrgUnitId: candidate.personToOrgUnitId,
				personName: candidate.personName,
				personSlug: candidate.personSlug,
				compensationRole: candidate.compensationRole,
			};
		});

	// Section 2 candidates: cross-cutting compensated relations active in the year, minus the ones
	// already claimed for this report.
	const claimedManualIds = new Set(manualContributions.map((c) => c.personToOrgUnitId));
	const manualCandidates = (await getManualContributionCandidates(year)).filter(
		(candidate) => !claimedManualIds.has(candidate.personToOrgUnitId),
	);

	const canManageRelations = user.role === "admin";

	return (
		<div className="flex flex-col gap-y-12">
			<CountryReportContributorsSnapshotForm
				canManageRelations={canManageRelations}
				contributors={snapshotContributors}
				countryReportId={report.id}
				missing={missingSnapshotContributors}
				refreshAction={refreshCountryReportContributionsAction}
			/>

			<CountryReportClaimedContributorsForm
				addAction={createCountryReportContributionAction}
				availableContributions={manualCandidates}
				deleteAction={deleteCountryReportContributionAction}
				report={{ id: report.id, contributions: manualContributions }}
			/>

			<CountryReportContributorsForm
				formAction={updateCountryReportContributorsAction}
				report={{ id: report.id, totalContributors: report.totalContributors }}
			/>

			<ReportScreenCommentSection
				reportId={report.id}
				reportType="country"
				screenKey="contributors"
			/>
		</div>
	);
}
