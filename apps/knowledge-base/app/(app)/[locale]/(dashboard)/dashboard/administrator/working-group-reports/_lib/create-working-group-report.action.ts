"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { CreateWorkingGroupReportActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-group-reports/_lib/create-working-group-report.schema";
import { getWorkingGroupChairCandidates } from "@/lib/data/working-group-report-chairs";
import { getCarriedOverWorkingGroupReportSocialMedia } from "@/lib/data/working-group-report-social-media";
import { db } from "@/lib/db";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createWorkingGroupReportAction = createMutationAction({
	schema: CreateWorkingGroupReportActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "working_group_reports" },
	revalidate: "/[locale]/dashboard/administrator/working-group-reports",
	redirect: "/dashboard/administrator/working-group-reports",

	async preCheck({ input }) {
		const t = await getExtracted();

		const campaign = await db.query.reportingCampaigns.findFirst({
			where: { id: input.campaignId },
			columns: { status: true },
		});

		if (campaign?.status !== "open") {
			return createActionStateError({
				message: t("Only open campaigns can be used for new reports."),
			});
		}

		const existing = await db.query.workingGroupReports.findFirst({
			// input.workingGroupId is the working group's document id.
			where: { campaignId: input.campaignId, workingGroupDocumentId: input.workingGroupId },
			columns: { id: true },
		});

		if (existing != null) {
			return createActionStateError({
				message: t("A report for this working group and campaign already exists."),
			});
		}

		return undefined;
	},

	async mutate(tx, input) {
		const [created] = await tx
			.insert(schema.workingGroupReports)
			.values({
				campaignId: input.campaignId,
				workingGroupDocumentId: input.workingGroupId,
				status: input.status,
			})
			.returning({ id: schema.workingGroupReports.id });

		assert(created);

		// Carry over the social media coverage set from last year's report for the same working group.
		const campaign = await tx.query.reportingCampaigns.findFirst({
			where: { id: input.campaignId },
			columns: { year: true },
		});

		if (campaign != null) {
			const chairs = await getWorkingGroupChairCandidates(input.workingGroupId, campaign.year, tx);
			if (chairs.length > 0) {
				await tx.insert(schema.workingGroupReportChairs).values(
					chairs.map((chair) => {
						return {
							workingGroupReportId: created.id,
							personToOrgUnitId: chair.personToOrgUnitId,
							chairRole: chair.chairRole,
						};
					}),
				);
			}

			const previousCampaign = await tx.query.reportingCampaigns.findFirst({
				where: { year: campaign.year - 1 },
				columns: { id: true },
			});
			const previousReport =
				previousCampaign == null
					? null
					: await tx.query.workingGroupReports.findFirst({
							where: {
								campaignId: previousCampaign.id,
								workingGroupDocumentId: input.workingGroupId,
							},
							columns: { id: true },
						});
			const carriedSocialMediaIds =
				previousReport == null
					? []
					: await getCarriedOverWorkingGroupReportSocialMedia(previousReport.id);

			if (carriedSocialMediaIds.length > 0) {
				await tx.insert(schema.workingGroupReportSocialMedia).values(
					carriedSocialMediaIds.map((socialMediaId) => {
						return { workingGroupReportId: created.id, socialMediaId };
					}),
				);
			}
		}

		return { subjectId: created.id };
	},
});
