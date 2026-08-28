"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { CreateCountryReportContributionActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/create-country-report-contribution.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { getManualContributionCandidateForReport } from "@/lib/data/report-contributions";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createCountryReportContributionAction = createMutationAction({
	schema: CreateCountryReportContributionActionInputSchema,
	requireAuth: true,
	audit: { action: "create", subjectType: "country_report" },
	revalidate: countryReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		const t = await getExtracted();
		await assertCan(ctx.user, "update", {
			type: "country_report",
			id: input.countryReportId,
		});
		await assertReportEditable(ctx.user, { type: "country_report", id: input.countryReportId });

		const existing = await db.query.countryReportContributions.findFirst({
			where: {
				countryReportId: input.countryReportId,
				personToOrgUnitId: input.personToOrgUnitId,
			},
			columns: { id: true },
		});

		if (existing != null) {
			return createActionStateError({
				message: t("This person is already listed as a contributor."),
			});
		}

		// Only cross-cutting (Section 2) relations active in the campaign year may be claimed manually;
		// coordinator/deputy contributions are managed by the snapshot, not added here.
		const candidate = await getManualContributionCandidateForReport(
			input.countryReportId,
			input.personToOrgUnitId,
		);
		if (candidate == null) {
			return createActionStateError({
				message: t("This person is not an eligible contributor for this campaign."),
			});
		}

		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		const candidate = await getManualContributionCandidateForReport(
			input.countryReportId,
			input.personToOrgUnitId,
		);
		assert(candidate, "Contribution is not eligible.");

		await tx.insert(schema.countryReportContributions).values({
			countryReportId: input.countryReportId,
			personToOrgUnitId: input.personToOrgUnitId,
			contributionRole: candidate.compensationRole,
		});

		return { subjectId: input.countryReportId, successMessage: t("Added.") };
	},
});
