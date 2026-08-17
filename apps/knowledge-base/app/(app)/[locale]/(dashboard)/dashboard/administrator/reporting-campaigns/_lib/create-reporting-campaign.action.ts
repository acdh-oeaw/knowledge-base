"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { CreateReportingCampaignActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/create-reporting-campaign.schema";
import { db } from "@/lib/db";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createReportingCampaignAction = createMutationAction({
	schema: CreateReportingCampaignActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "reporting_campaigns" },
	revalidate: "/[locale]/dashboard/administrator/reporting-campaigns",
	redirect: "/dashboard/administrator/reporting-campaigns",

	async preCheck({ input }) {
		const t = await getExtracted();
		const existing = await db.query.reportingCampaigns.findFirst({
			where: { year: input.year },
			columns: { id: true },
		});

		if (existing != null) {
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
		const [created] = await tx
			.insert(schema.reportingCampaigns)
			.values({ year: input.year, status: input.status })
			.returning({ id: schema.reportingCampaigns.id });
		assert(created);

		return { subjectId: created.id };
	},
});
