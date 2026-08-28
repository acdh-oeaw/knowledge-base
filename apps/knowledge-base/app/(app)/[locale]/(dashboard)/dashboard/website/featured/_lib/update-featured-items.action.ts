"use server";

import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { UpdateFeaturedItemsActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/featured/_lib/update-featured-items.schema";
import { isPublishedEntityVersions } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { eq, sql } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateFeaturedItemsAction = createMutationAction({
	schema: UpdateFeaturedItemsActionInputSchema,
	requireAdmin: true,
	/** Site metadata is a singleton — no per-row id. */
	audit: { action: "update", subjectType: "metadata" },
	revalidate: "/[locale]/dashboard/website/featured",

	async preCheck({ input }) {
		const t = await getExtracted();

		if (
			!(await isPublishedEntityVersions(db, [...input.featuredNewsIds, ...input.featuredEventIds]))
		) {
			return createActionStateError({
				message: t("Featured items must be published."),
			});
		}

		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		/**
		 * `title`/`description` are NOT NULL, so we can't safely upsert an empty singleton row here.
		 * The site metadata row is created on the metadata page, so we only update the existing row.
		 */
		await tx
			.update(schema.siteMetadata)
			.set({
				featuredItemIds: { news: input.featuredNewsIds, events: input.featuredEventIds },
				updatedAt: sql`NOW()`,
			})
			.where(eq(schema.siteMetadata.id, 1));

		return { subjectId: "site", successMessage: t("Featured items saved.") };
	},

	async postCommit() {
		await dispatchWebhook({ type: "featured-entities" });
	},
});
