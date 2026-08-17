import * as schema from "@dariah-eric/database/schema";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { CountryReportProjectsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-projects-form";
import { createCountryReportProjectContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/create-country-report-project-contribution.action";
import { deleteCountryReportProjectContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/delete-country-report-project-contribution.action";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { assertAuthenticated } from "@/lib/auth/session";
import { publishedEntityVersionWhere } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

interface CountryReportProjectsScreenProps {
	reportId: string;
}

/** Shared "projects" screen. See {@link getAuthorizedCountryReportForUser} for authorization. */
export async function CountryReportProjectsScreen(
	props: Readonly<CountryReportProjectsScreenProps>,
): Promise<ReactNode> {
	const { reportId } = props;

	const { user } = await assertAuthenticated();
	const [result, allProjects] = await Promise.all([
		getAuthorizedCountryReportForUser(
			user,
			reportId,
			(id) =>
				db.query.countryReports.findFirst({
					where: { id },
					columns: { id: true },
					with: {
						projectContributions: {
							columns: { id: true, amountEuros: true, projectDocumentId: true },
							with: {
								project: { columns: { name: true } },
							},
						},
					},
				}),
			"update",
		),
		db
			// `id` is the project document id (entities.id) so it lines up with the document-level
			// project_document_id stored on the contribution.
			.select({ id: schema.entityVersions.entityId, name: schema.projects.name })
			.from(schema.projects)
			.innerJoin(schema.entityVersions, eq(schema.projects.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(publishedEntityVersionWhere())
			.orderBy(schema.projects.name),
	]);

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;
	if (report == null) {
		notFound();
	}

	return (
		<div className="flex flex-col gap-y-12">
			<CountryReportProjectsForm
				addAction={createCountryReportProjectContributionAction}
				allProjects={allProjects}
				deleteAction={deleteCountryReportProjectContributionAction}
				report={report}
			/>

			<ReportScreenCommentSection reportId={report.id} reportType="country" screenKey="projects" />
		</div>
	);
}
