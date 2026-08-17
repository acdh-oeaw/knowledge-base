"use server";

import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { CreateSpotlightArticleContributorActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_lib/create-spotlight-article-contributor.schema";
import { db } from "@/lib/db";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createSpotlightArticleContributorAction = createMutationAction({
	schema: CreateSpotlightArticleContributorActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "spotlight_articles" },
	revalidate: "/[locale]/dashboard/website/spotlight-articles",

	async preCheck({ input }) {
		const t = await getExtracted();

		// articleId and personId are document ids (entities.id). Contributors are document-level and do
		// not require the edited article to be published (the person picker restricts to published).
		const existing = await db.query.spotlightArticlesToPersons.findFirst({
			where: { spotlightArticleDocumentId: input.articleId, personDocumentId: input.personId },
			columns: { personDocumentId: true },
		});

		if (existing != null) {
			return createActionStateError({ message: t("This contributor already exists.") });
		}

		return undefined;
	},

	async mutate(tx, input) {
		await tx.insert(schema.spotlightArticlesToPersons).values({
			spotlightArticleDocumentId: input.articleId,
			personDocumentId: input.personId,
			role: input.role,
		});

		return { subjectId: input.articleId };
	},
});
