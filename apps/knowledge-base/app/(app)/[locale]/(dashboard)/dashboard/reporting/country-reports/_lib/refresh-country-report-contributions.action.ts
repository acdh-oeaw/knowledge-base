"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { RefreshCountryReportContributionsActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/refresh-country-report-contributions.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import {
	getSnapshotContributionCandidates,
	snapshotCompensationRoles,
} from "@/lib/data/report-contributions";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { and, eq, inArray, or } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

/**
 * Re-captures only the country report's Section-1 contributions (national coordinator + deputy)
 * from the current relations, leaving the manually-claimed cross-cutting contributions untouched.
 * Authorized via the report's `update` permission (admins + the country's coordinators).
 */
export const refreshCountryReportContributionsAction = createMutationAction({
	schema: RefreshCountryReportContributionsActionInputSchema,
	requireAuth: true,
	audit: { action: "update", subjectType: "country_report" },
	revalidate: countryReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", { type: "country_report", id: input.countryReportId });
		await assertReportEditable(ctx.user, { type: "country_report", id: input.countryReportId });
		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		const report = await tx.query.countryReports.findFirst({
			where: { id: input.countryReportId },
			columns: { countryDocumentId: true },
			with: { campaign: { columns: { year: true } } },
		});

		assert(report, "Country report not found.");

		const candidates = await getSnapshotContributionCandidates(
			report.countryDocumentId,
			report.campaign.year,
		);
		const candidateIds = candidates.map((candidate) => candidate.personToOrgUnitId);

		// Remove the existing snapshot rows (stored snapshot roles) plus any row that would collide with
		// a candidate (covers legacy rows captured before the role was tracked), then re-insert.
		const removable = [
			inArray(schema.countryReportContributions.contributionRole, [...snapshotCompensationRoles]),
			...(candidateIds.length > 0
				? [inArray(schema.countryReportContributions.personToOrgUnitId, candidateIds)]
				: []),
		];
		await tx
			.delete(schema.countryReportContributions)
			.where(
				and(
					eq(schema.countryReportContributions.countryReportId, input.countryReportId),
					or(...removable),
				),
			);

		if (candidates.length > 0) {
			await tx.insert(schema.countryReportContributions).values(
				candidates.map((candidate) => {
					return {
						countryReportId: input.countryReportId,
						personToOrgUnitId: candidate.personToOrgUnitId,
						contributionRole: candidate.compensationRole,
					};
				}),
			);
		}

		return {
			subjectId: input.countryReportId,
			successMessage: t("Coordinator contributors updated from current relations."),
		};
	},
});
