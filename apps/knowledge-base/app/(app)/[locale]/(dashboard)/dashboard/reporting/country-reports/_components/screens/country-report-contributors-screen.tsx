import * as schema from "@dariah-eric/database/schema";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { CountryReportClaimedContributorsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-claimed-contributors-form";
import { CountryReportContributorsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-contributors-form";
import { createCountryReportContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/create-country-report-contribution.action";
import { deleteCountryReportContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/delete-country-report-contribution.action";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { updateCountryReportContributorsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/update-country-report-contributors.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { alias, and, eq, inArray, notInArray, or, sql } from "@/lib/db/sql";

interface CountryReportContributorsScreenProps {
	reportId: string;
}

/** Shared "contributors" screen. See {@link getAuthorizedCountryReportForUser} for authorization. */
export async function CountryReportContributorsScreen(
	props: Readonly<CountryReportContributorsScreenProps>,
): Promise<ReactNode> {
	const { reportId } = props;

	const { user } = await assertAuthenticated();
	const result = await getAuthorizedCountryReportForUser(
		user,
		reportId,
		async (id) => {
			const base = await db.query.countryReports.findFirst({
				where: { id },
				// countryDocumentId is the country's document id (entities.id), used to match
				// document-level person↔org relations below.
				columns: { id: true, totalContributors: true, countryDocumentId: true },
				with: {
					campaign: { columns: { year: true } },
				},
			});

			if (base == null) {
				return null;
			}

			const personDocumentLifecycle = alias(schema.documentLifecycle, "person_document_lifecycle");
			const organisationalUnitDocumentLifecycle = alias(
				schema.documentLifecycle,
				"organisational_unit_document_lifecycle",
			);
			const claimedRows = await db
				.select({
					id: schema.countryReportContributions.id,
					personToOrgUnitId: schema.countryReportContributions.personToOrgUnitId,
					personName: schema.persons.name,
					orgUnitName: schema.organisationalUnits.name,
					roleType: schema.personRoleTypes.type,
				})
				.from(schema.countryReportContributions)
				.innerJoin(
					schema.personsToOrganisationalUnits,
					eq(
						schema.personsToOrganisationalUnits.id,
						schema.countryReportContributions.personToOrgUnitId,
					),
				)
				.innerJoin(
					personDocumentLifecycle,
					eq(
						personDocumentLifecycle.documentId,
						schema.personsToOrganisationalUnits.personDocumentId,
					),
				)
				.innerJoin(
					schema.persons,
					sql`${schema.persons.id} = COALESCE(${personDocumentLifecycle.draftId}, ${personDocumentLifecycle.publishedId})`,
				)
				.innerJoin(
					organisationalUnitDocumentLifecycle,
					eq(
						organisationalUnitDocumentLifecycle.documentId,
						schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
					),
				)
				.innerJoin(
					schema.organisationalUnits,
					sql`${schema.organisationalUnits.id} = COALESCE(${organisationalUnitDocumentLifecycle.draftId}, ${organisationalUnitDocumentLifecycle.publishedId})`,
				)
				.innerJoin(
					schema.personRoleTypes,
					eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
				)
				.where(eq(schema.countryReportContributions.countryReportId, id));

			return {
				id: base.id,
				totalContributors: base.totalContributors,
				campaign: base.campaign,
				country: { id: base.countryDocumentId },
				contributions: claimedRows.map((row) => {
					return {
						id: row.id,
						personToOrgUnit: {
							id: row.personToOrgUnitId,
							person: { name: row.personName },
							organisationalUnit: { name: row.orgUnitName },
							roleType: { type: row.roleType },
						},
					};
				}),
			};
		},
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
	const claimedIds = report.contributions.map((c) => c.personToOrgUnit.id);

	const availablePersonDocumentLifecycle = alias(
		schema.documentLifecycle,
		"available_person_document_lifecycle",
	);
	const availableOrganisationalUnitDocumentLifecycle = alias(
		schema.documentLifecycle,
		"available_organisational_unit_document_lifecycle",
	);
	const availablePersonToOrgUnits = await db
		.select({
			id: schema.personsToOrganisationalUnits.id,
			personName: schema.persons.name,
			orgUnitName: schema.organisationalUnits.name,
			roleType: schema.personRoleTypes.type,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			availablePersonDocumentLifecycle,
			eq(
				availablePersonDocumentLifecycle.documentId,
				schema.personsToOrganisationalUnits.personDocumentId,
			),
		)
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${availablePersonDocumentLifecycle.draftId}, ${availablePersonDocumentLifecycle.publishedId})`,
		)
		.innerJoin(
			availableOrganisationalUnitDocumentLifecycle,
			eq(
				availableOrganisationalUnitDocumentLifecycle.documentId,
				schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${availableOrganisationalUnitDocumentLifecycle.draftId}, ${availableOrganisationalUnitDocumentLifecycle.publishedId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personsToOrganisationalUnits.roleTypeId, schema.personRoleTypes.id),
		)
		.where(
			and(
				or(
					and(
						inArray(schema.personRoleTypes.type, [
							"national_coordinator",
							"national_coordinator_deputy",
							"national_coordination_staff",
							"national_representative",
							"national_representative_deputy",
						]),
						eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, report.country.id),
					),
					and(
						inArray(schema.personRoleTypes.type, ["is_chair_of", "is_vice_chair_of"]),
						eq(schema.organisationalUnitTypes.type, "working_group"),
					),
					and(
						eq(schema.personRoleTypes.type, "is_member_of"),
						eq(schema.organisationalUnitTypes.type, "governance_body"),
					),
				),
				sql`
					${schema.personsToOrganisationalUnits.duration} && tstzrange (
						MAKE_DATE(${year}, 1, 1)::TIMESTAMPTZ,
						MAKE_DATE(${year + 1}, 1, 1)::TIMESTAMPTZ
					)
				`,
				...(claimedIds.length > 0
					? [notInArray(schema.personsToOrganisationalUnits.id, claimedIds)]
					: []),
			),
		)
		.orderBy(schema.persons.sortName, schema.personRoleTypes.type);

	return (
		<div className="flex flex-col gap-y-12">
			<CountryReportClaimedContributorsForm
				addAction={createCountryReportContributionAction}
				availablePersonToOrgUnits={availablePersonToOrgUnits}
				deleteAction={deleteCountryReportContributionAction}
				report={report}
			/>
			<CountryReportContributorsForm
				formAction={updateCountryReportContributorsAction}
				report={report}
			/>

			<ReportScreenCommentSection
				reportId={report.id}
				reportType="country"
				screenKey="contributors"
			/>
		</div>
	);
}
