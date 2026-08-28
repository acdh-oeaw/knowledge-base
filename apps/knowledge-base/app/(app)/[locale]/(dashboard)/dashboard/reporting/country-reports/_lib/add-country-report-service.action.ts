"use server";

import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { AddCountryReportServiceActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/add-country-report-service.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { createMutationAction } from "@/lib/server/create-mutation-action";

/** Adds an existing live service to a country report's coverage set. */
export const addCountryReportServiceAction = createMutationAction({
	schema: AddCountryReportServiceActionInputSchema,
	requireAuth: true,
	audit: { action: "create", subjectType: "country_report" },
	revalidate: countryReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		const t = await getExtracted();
		await assertCan(ctx.user, "update", { type: "country_report", id: input.countryReportId });
		await assertReportEditable(ctx.user, { type: "country_report", id: input.countryReportId });

		const [service, existing] = await Promise.all([
			db.query.services.findFirst({
				where: { id: input.serviceId, status: { status: "live" } },
				columns: { id: true },
			}),
			db.query.countryReportServices.findFirst({
				where: {
					countryReportId: input.countryReportId,
					serviceId: input.serviceId,
				},
				columns: { id: true },
			}),
		]);

		if (service == null) {
			return createActionStateError({ message: t("Only live services can be added.") });
		}
		if (existing != null) {
			return createActionStateError({ message: t("This service is already listed.") });
		}

		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		await tx.insert(schema.countryReportServices).values({
			countryReportId: input.countryReportId,
			serviceId: input.serviceId,
		});

		return { subjectId: input.countryReportId, successMessage: t("Added.") };
	},
});
