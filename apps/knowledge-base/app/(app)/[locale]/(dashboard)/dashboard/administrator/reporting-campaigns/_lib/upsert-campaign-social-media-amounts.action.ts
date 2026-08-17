"use server";

import * as schema from "@dariah-eric/database/schema";
import { reportingCampaignSocialMediaCategoryEnum } from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { UpsertCampaignSocialMediaAmountsActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/upsert-campaign-social-media-amounts.schema";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const upsertCampaignSocialMediaAmountsAction = createMutationAction({
	schema: UpsertCampaignSocialMediaAmountsActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "reporting_campaigns" },
	revalidate: "/[locale]/dashboard/administrator/reporting-campaigns",

	async mutate(tx, input) {
		const t = await getExtracted();
		const { id, ...amounts } = input;

		for (const category of reportingCampaignSocialMediaCategoryEnum) {
			const amount = amounts[category];
			if (amount == null) {
				continue;
			}

			await tx
				.insert(schema.reportingCampaignSocialMediaAmounts)
				.values({ campaignId: id, category, amount })
				.onConflictDoUpdate({
					target: [
						schema.reportingCampaignSocialMediaAmounts.campaignId,
						schema.reportingCampaignSocialMediaAmounts.category,
					],
					set: { amount },
				});
		}

		return { subjectId: id, successMessage: t("Saved.") };
	},
});
