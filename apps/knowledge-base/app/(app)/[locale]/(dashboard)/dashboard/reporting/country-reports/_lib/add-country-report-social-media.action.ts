"use server";

import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { AddCountryReportSocialMediaActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/add-country-report-social-media.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { createMutationAction } from "@/lib/server/create-mutation-action";

/** Adds an existing social media account to the country report's coverage set. */
export const addCountryReportSocialMediaAction = createMutationAction({
	schema: AddCountryReportSocialMediaActionInputSchema,
	requireAuth: true,
	audit: { action: "create", subjectType: "country_report" },
	revalidate: countryReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		const t = await getExtracted();
		await assertCan(ctx.user, "update", { type: "country_report", id: input.countryReportId });
		await assertReportEditable(ctx.user, { type: "country_report", id: input.countryReportId });

		const existing = await db.query.countryReportSocialMedia.findFirst({
			where: {
				countryReportId: input.countryReportId,
				socialMediaId: input.socialMediaId,
			},
			columns: { id: true },
		});

		if (existing != null) {
			return createActionStateError({ message: t("This account is already listed.") });
		}

		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		await tx.insert(schema.countryReportSocialMedia).values({
			countryReportId: input.countryReportId,
			socialMediaId: input.socialMediaId,
		});

		return { subjectId: input.countryReportId, successMessage: t("Added.") };
	},
});
