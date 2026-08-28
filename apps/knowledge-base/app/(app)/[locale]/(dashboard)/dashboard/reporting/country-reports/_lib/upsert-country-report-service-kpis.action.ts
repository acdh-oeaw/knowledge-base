"use server";

import * as schema from "@dariah-eric/database/schema";
import { serviceKpiCategoryEnum } from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";
import * as v from "valibot";

import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { and, eq, inArray } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

const UpsertCountryReportServiceKpisSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	kpis: v.optional(
		v.record(
			v.string(),
			v.record(
				v.picklist(serviceKpiCategoryEnum),
				v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0)),
			),
		),
	),
});

/**
 * Saves the per-service KPI values for a country report. Replace-set semantics scoped to the
 * country's services (resolved via its consortium): a removed/blanked metric is dropped from the
 * form data, so re-writing the set is what clears it, and a forged `serviceId` outside the
 * country's services is ignored.
 */
export const upsertCountryReportServiceKpisAction = createMutationAction({
	schema: UpsertCountryReportServiceKpisSchema,
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

		const memberships = await tx.query.countryReportServices.findMany({
			where: { countryReportId: input.id },
			columns: { serviceId: true },
		});
		const allowedServiceIds = new Set(memberships.map((membership) => membership.serviceId));

		const rows = Object.entries(input.kpis ?? {}).flatMap(([serviceId, kpiValues]) => {
			if (!allowedServiceIds.has(serviceId)) {
				return [];
			}
			return Object.entries(kpiValues).map(([kpi, value]) => {
				return {
					countryReportId: input.id,
					serviceId,
					kpi: kpi as (typeof serviceKpiCategoryEnum)[number],
					value,
				};
			});
		});

		if (allowedServiceIds.size > 0) {
			await tx
				.delete(schema.countryReportServiceKpis)
				.where(
					and(
						eq(schema.countryReportServiceKpis.countryReportId, input.id),
						inArray(schema.countryReportServiceKpis.serviceId, [...allowedServiceIds]),
					),
				);

			if (rows.length > 0) {
				await tx.insert(schema.countryReportServiceKpis).values(rows);
			}
		}

		return { subjectId: input.id, successMessage: t("Saved.") };
	},
});
