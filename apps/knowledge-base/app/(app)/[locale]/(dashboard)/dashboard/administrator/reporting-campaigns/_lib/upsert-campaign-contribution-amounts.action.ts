"use server";

import * as schema from "@dariah-eric/database/schema";
import { reportingCampaignContributionRoleEnum } from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { UpsertCampaignContributionAmountsActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/upsert-campaign-contribution-amounts.schema";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const upsertCampaignContributionAmountsAction = createMutationAction({
	schema: UpsertCampaignContributionAmountsActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "reporting_campaigns" },
	revalidate: "/[locale]/dashboard/administrator/reporting-campaigns",

	async mutate(tx, input) {
		const t = await getExtracted();
		const { id, ...amounts } = input;

		for (const roleType of reportingCampaignContributionRoleEnum) {
			const amount = amounts[roleType];
			if (amount == null) {
				continue;
			}

			await tx
				.insert(schema.reportingCampaignContributionAmounts)
				.values({ campaignId: id, roleType, amount })
				.onConflictDoUpdate({
					target: [
						schema.reportingCampaignContributionAmounts.campaignId,
						schema.reportingCampaignContributionAmounts.roleType,
					],
					set: { amount },
				});
		}

		return { subjectId: id, successMessage: t("Saved.") };
	},
});
