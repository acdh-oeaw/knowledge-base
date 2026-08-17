"use server";

import * as schema from "@dariah-eric/database/schema";

import { UpdateCountryReportActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/country-reports/_lib/update-country-report.schema";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateCountryReportAction = createMutationAction({
	schema: UpdateCountryReportActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "country_reports" },
	revalidate: "/[locale]/dashboard/administrator/country-reports",
	redirect: "/dashboard/administrator/country-reports",

	async mutate(tx, input) {
		await tx
			.update(schema.countryReports)
			.set({ status: input.status })
			.where(eq(schema.countryReports.id, input.id));

		return { subjectId: input.id };
	},
});
