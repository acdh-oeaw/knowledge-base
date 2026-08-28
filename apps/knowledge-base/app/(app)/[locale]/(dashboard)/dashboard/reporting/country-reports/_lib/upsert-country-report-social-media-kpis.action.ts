"use server";

import * as schema from "@dariah-eric/database/schema";
import { socialMediaKpiCategoryEnum } from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";
import * as v from "valibot";

import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { and, eq, inArray } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

const UpsertCountryReportSocialMediaKpisSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	kpis: v.optional(
		v.record(
			v.string(),
			v.record(
				v.picklist(socialMediaKpiCategoryEnum),
				v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0)),
			),
		),
	),
});

/**
 * Saves the per-account KPI values for a country report. Replace-set semantics scoped to the
 * report's covered accounts (its `country_report_social_media` membership): a removed/blanked
 * metric is dropped from the form data, so re-writing the set is what clears it, and a forged
 * `socialMediaId` for an account the report doesn't cover is ignored.
 */
export const upsertCountryReportSocialMediaKpisAction = createMutationAction({
	schema: UpsertCountryReportSocialMediaKpisSchema,
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

		const memberships = await tx.query.countryReportSocialMedia.findMany({
			where: { countryReportId: input.id },
			columns: { socialMediaId: true },
		});
		const allowedSocialMediaIds = new Set(memberships.map((m) => m.socialMediaId));

		const rows = Object.entries(input.kpis ?? {}).flatMap(([socialMediaId, kpiValues]) => {
			if (!allowedSocialMediaIds.has(socialMediaId)) {
				return [];
			}
			return Object.entries(kpiValues).map(([kpi, value]) => {
				return {
					countryReportId: input.id,
					socialMediaId,
					kpi: kpi as (typeof socialMediaKpiCategoryEnum)[number],
					value,
				};
			});
		});

		if (allowedSocialMediaIds.size > 0) {
			await tx
				.delete(schema.countryReportSocialMediaKpis)
				.where(
					and(
						eq(schema.countryReportSocialMediaKpis.countryReportId, input.id),
						inArray(schema.countryReportSocialMediaKpis.socialMediaId, [...allowedSocialMediaIds]),
					),
				);

			if (rows.length > 0) {
				await tx.insert(schema.countryReportSocialMediaKpis).values(rows);
			}
		}

		return { subjectId: input.id, successMessage: t("Saved.") };
	},
});
