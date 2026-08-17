"use server";

import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { UpsertCampaignServiceSizesActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/upsert-campaign-service-sizes.schema";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const upsertCampaignServiceSizesAction = createMutationAction({
	schema: UpsertCampaignServiceSizesActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "reporting_campaigns" },
	revalidate: "/[locale]/dashboard/administrator/reporting-campaigns",

	async mutate(tx, input) {
		const t = await getExtracted();

		const tiered = [
			{
				serviceSize: "small" as const,
				threshold: input.small_threshold,
				amount: input.small_amount,
			},
			{
				serviceSize: "medium" as const,
				threshold: input.medium_threshold,
				amount: input.medium_amount,
			},
			{
				serviceSize: "large" as const,
				threshold: input.large_threshold,
				amount: input.large_amount,
			},
			{
				serviceSize: "very_large" as const,
				threshold: input.very_large_threshold,
				amount: input.very_large_amount,
			},
		];

		for (const { serviceSize, threshold, amount } of tiered) {
			if (amount == null) {
				continue;
			}

			await tx
				.insert(schema.reportingCampaignServiceSizes)
				.values({
					campaignId: input.id,
					serviceSize,
					visitsThreshold: threshold ?? null,
					amount,
				})
				.onConflictDoUpdate({
					target: [
						schema.reportingCampaignServiceSizes.campaignId,
						schema.reportingCampaignServiceSizes.serviceSize,
					],
					set: { visitsThreshold: threshold ?? null, amount },
				});
		}

		if (input.core_amount != null) {
			await tx
				.insert(schema.reportingCampaignServiceSizes)
				.values({
					campaignId: input.id,
					serviceSize: "core",
					visitsThreshold: null,
					amount: input.core_amount,
				})
				.onConflictDoUpdate({
					target: [
						schema.reportingCampaignServiceSizes.campaignId,
						schema.reportingCampaignServiceSizes.serviceSize,
					],
					set: { amount: input.core_amount },
				});
		}

		return { subjectId: input.id, successMessage: t("Saved.") };
	},
});
