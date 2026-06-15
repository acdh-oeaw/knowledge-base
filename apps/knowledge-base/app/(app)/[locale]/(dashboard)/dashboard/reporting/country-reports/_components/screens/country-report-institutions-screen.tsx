import * as schema from "@acdh-knowledge-base/database/schema";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { CountryReportInstitutionsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-institutions-form";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { refreshCountryReportInstitutionsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/refresh-country-report-institutions.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { getCurrentPartnerInstitutions } from "@/lib/data/unit-relations";
import { db } from "@/lib/db";
import { inArray } from "@/lib/db/sql";

interface CountryReportInstitutionsScreenProps {
	reportId: string;
}

/**
 * Shared "institutions" screen rendered by both the reporting flow and the admin tree.
 * Self-authorizes via {@link getAuthorizedCountryReportForUser} (admins pass `can`; others get
 * `notFound`).
 *
 * Read-only review of the report's _frozen_ institutions snapshot (`countryReportInstitutions`),
 * cross-checked against the country's _current_ partner institutions for the campaign year so drift
 * is visible. Editing the underlying relations happens on the institution/country screens; the only
 * mutation here is "refresh", which re-captures the snapshot from those relations.
 */
export async function CountryReportInstitutionsScreen(
	props: Readonly<CountryReportInstitutionsScreenProps>,
): Promise<ReactNode> {
	const { reportId } = props;

	const { user } = await assertAuthenticated();
	const result = await getAuthorizedCountryReportForUser(
		user,
		reportId,
		(id) =>
			db.query.countryReports.findFirst({
				where: { id },
				columns: { id: true, countryDocumentId: true },
				with: {
					campaign: { columns: { year: true } },
					institutions: {
						columns: { id: true, organisationalUnitDocumentId: true, representationType: true },
						with: {
							organisationalUnit: { columns: { name: true, acronym: true } },
						},
					},
				},
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

	// The country's current partner institutions for the reporting year — the truth the snapshot is
	// reviewed against.
	const currentPartners = await getCurrentPartnerInstitutions(report.countryDocumentId, year);
	const currentByDocumentId = new Map(
		currentPartners.map((partner) => [partner.institutionDocumentId, partner] as const),
	);

	// Resolve slugs for the snapshot institutions (for the "edit on the institution" links).
	const snapshotDocumentIds = report.institutions.map((i) => i.organisationalUnitDocumentId);
	const slugRows =
		snapshotDocumentIds.length > 0
			? await db
					.select({ id: schema.entities.id, slug: schema.entities.slug })
					.from(schema.entities)
					.where(inArray(schema.entities.id, snapshotDocumentIds))
			: [];
	const slugByDocumentId = new Map(slugRows.map((row) => [row.id, row.slug] as const));

	const institutions = report.institutions.map((institution) => {
		const current = currentByDocumentId.get(institution.organisationalUnitDocumentId) ?? null;

		return {
			id: institution.id,
			documentId: institution.organisationalUnitDocumentId,
			name: institution.organisationalUnit?.name ?? current?.name ?? "",
			acronym: institution.organisationalUnit?.acronym ?? current?.acronym ?? null,
			slug: slugByDocumentId.get(institution.organisationalUnitDocumentId) ?? current?.slug ?? null,
			// Frozen at capture; may be null for rows captured before representation type was tracked.
			representationType: institution.representationType,
			isCurrent: current != null,
			currentRepresentationType: current?.representationType ?? null,
		};
	});

	const snapshotDocumentIdSet = new Set(snapshotDocumentIds);
	const missing = currentPartners.filter(
		(partner) => !snapshotDocumentIdSet.has(partner.institutionDocumentId),
	);

	return (
		<div className="flex flex-col gap-y-12">
			<CountryReportInstitutionsForm
				canManageRelations={user.role === "admin"}
				countryReportId={report.id}
				institutions={institutions}
				missing={missing}
				refreshAction={refreshCountryReportInstitutionsAction}
			/>

			<ReportScreenCommentSection
				reportId={report.id}
				reportType="country"
				screenKey="institutions"
			/>
		</div>
	);
}
