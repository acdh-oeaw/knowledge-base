"use server";

import * as schema from "@dariah-eric/database/schema";
import { reportingCampaignEventTypeEnum } from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { UpsertCampaignEventAmountsActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/upsert-campaign-event-amounts.schema";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const upsertCampaignEventAmountsAction = createMutationAction({
	schema: UpsertCampaignEventAmountsActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "reporting_campaigns" },
	revalidate: "/[locale]/dashboard/administrator/reporting-campaigns",

	async mutate(tx, input) {
		const t = await getExtracted();
		const { id, ...amounts } = input;

		for (const eventType of reportingCampaignEventTypeEnum) {
			const amount = amounts[eventType];
			if (amount == null) {
				continue;
			}

			await tx
				.insert(schema.reportingCampaignEventAmounts)
				.values({ campaignId: id, eventType, amount })
				.onConflictDoUpdate({
					target: [
						schema.reportingCampaignEventAmounts.campaignId,
						schema.reportingCampaignEventAmounts.eventType,
					],
					set: { amount },
				});
		}

		return { subjectId: id, successMessage: t("Saved.") };
	},
});
