"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { CreateCountryReportSocialMediaActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/create-country-report-social-media.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { createMutationAction } from "@/lib/server/create-mutation-action";

/**
 * Creates a new social media account and adds it to the country report's coverage set — for
 * accounts not yet in the system (e.g. a one-off event website).
 */
export const createCountryReportSocialMediaAction = createMutationAction({
	schema: CreateCountryReportSocialMediaActionInputSchema,
	requireAuth: true,
	audit: { action: "create", subjectType: "country_report" },
	revalidate: countryReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", { type: "country_report", id: input.countryReportId });
		await assertReportEditable(ctx.user, { type: "country_report", id: input.countryReportId });
		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		const [created] = await tx
			.insert(schema.socialMedia)
			.values({ name: input.name, url: input.url, typeId: input.typeId })
			.returning({ id: schema.socialMedia.id });
		assert(created, "Failed to create social media account.");

		await tx.insert(schema.countryReportSocialMedia).values({
			countryReportId: input.countryReportId,
			socialMediaId: created.id,
		});

		return { subjectId: input.countryReportId, successMessage: t("Added.") };
	},
});
