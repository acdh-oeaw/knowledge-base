"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { RefreshCountryReportInstitutionsActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/refresh-country-report-institutions.schema";
import { assertCan } from "@/lib/auth/permissions";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { getCurrentPartnerInstitutions } from "@/lib/data/unit-relations";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

/**
 * Re-captures the country report's (frozen) institutions snapshot from the country's current
 * partner institutions for the campaign year. Authorized via the report's `update` permission, so
 * admins and the country's coordinators can run it. Editing the underlying relations happens on the
 * institution/country screens; this only reconciles the snapshot.
 */
export const refreshCountryReportInstitutionsAction = createMutationAction({
	schema: RefreshCountryReportInstitutionsActionInputSchema,
	requireAuth: true,
	audit: { action: "update", subjectType: "country_report" },
	revalidate: countryReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", { type: "country_report", id: input.countryReportId });
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

		const partners = await getCurrentPartnerInstitutions(
			report.countryDocumentId,
			report.campaign.year,
		);

		// Replace the snapshot wholesale so it mirrors the current partner-institution relations.
		await tx
			.delete(schema.countryReportInstitutions)
			.where(eq(schema.countryReportInstitutions.countryReportId, input.countryReportId));

		if (partners.length > 0) {
			await tx.insert(schema.countryReportInstitutions).values(
				partners.map((partner) => {
					return {
						countryReportId: input.countryReportId,
						organisationalUnitDocumentId: partner.institutionDocumentId,
						representationType: partner.representationType,
					};
				}),
			);
		}

		return {
			subjectId: input.countryReportId,
			successMessage: t("Institutions updated from current relations."),
		};
	},
});
