"use server";

import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { UpdateCountryReportEventsActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/update-country-report-events.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateCountryReportEventsAction = createMutationAction({
	schema: UpdateCountryReportEventsActionInputSchema,
	requireAuth: true,
	audit: { action: "update", subjectType: "country_report" },
	revalidate: countryReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", { type: "country_report", id: input.id });
		await assertReportEditable(ctx.user, { type: "country_report", id: input.id });
		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		await tx
			.update(schema.countryReports)
			.set({
				smallEvents: input.smallEvents ?? null,
				mediumEvents: input.mediumEvents ?? null,
				largeEvents: input.largeEvents ?? null,
				veryLargeEvents: input.veryLargeEvents ?? null,
				dariahCommissionedEvent: input.dariahCommissionedEvent ?? null,
				reusableOutcomes: input.reusableOutcomes ?? null,
			})
			.where(eq(schema.countryReports.id, input.id));

		return { subjectId: input.id, successMessage: t("Saved.") };
	},
});
