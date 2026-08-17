"use server";

import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { UpdateReportingCampaignActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/update-reporting-campaign.schema";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateReportingCampaignAction = createMutationAction({
	schema: UpdateReportingCampaignActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "reporting_campaigns" },
	revalidate: "/[locale]/dashboard/administrator/reporting-campaigns",
	redirect: "/dashboard/administrator/reporting-campaigns",

	async preCheck({ input }) {
		const t = await getExtracted();
		const existing = await db.query.reportingCampaigns.findFirst({
			where: { year: input.year },
			columns: { id: true },
		});

		if (existing != null && existing.id !== input.id) {
			return createActionStateError({
				message: t("A campaign for this year already exists."),
				validationErrors: {
					year: [t("A campaign for this year already exists.")],
				},
			});
		}

		return undefined;
	},

	async mutate(tx, input) {
		await tx
			.update(schema.reportingCampaigns)
			.set({ year: input.year, status: input.status })
			.where(eq(schema.reportingCampaigns.id, input.id));

		return { subjectId: input.id };
	},
});
