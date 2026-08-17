"use server";

import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { CreateImpactCaseStudyContributorActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/impact-case-studies/_lib/create-impact-case-study-contributor.schema";
import { db } from "@/lib/db";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createImpactCaseStudyContributorAction = createMutationAction({
	schema: CreateImpactCaseStudyContributorActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "impact_case_studies" },
	revalidate: "/[locale]/dashboard/website/impact-case-studies",

	async preCheck({ input }) {
		const t = await getExtracted();

		// articleId and personId are document ids (entities.id). Contributors are document-level and do
		// not require the edited case study to be published (the person picker restricts to published).
		const existing = await db.query.impactCaseStudiesToPersons.findFirst({
			where: { impactCaseStudyDocumentId: input.articleId, personDocumentId: input.personId },
			columns: { personDocumentId: true },
		});

		if (existing != null) {
			return createActionStateError({ message: t("This contributor already exists.") });
		}

		return undefined;
	},

	async mutate(tx, input) {
		await tx.insert(schema.impactCaseStudiesToPersons).values({
			impactCaseStudyDocumentId: input.articleId,
			personDocumentId: input.personId,
			role: input.role,
		});

		return { subjectId: input.articleId };
	},
});
