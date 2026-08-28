"use server";

import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { UpdateSiteMetadataActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/metadata/_lib/update-site-metadata.schema";
import { sql } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateSiteMetadataAction = createMutationAction({
	schema: UpdateSiteMetadataActionInputSchema,
	requireAdmin: true,
	/** Site metadata is a singleton — no per-row id. */
	audit: { action: "update", subjectType: "metadata" },
	revalidate: "/[locale]/dashboard/website/metadata",

	async mutate(tx, input) {
		const t = await getExtracted();

		let ogImageId: string | null = null;
		if (input.imageKey != null) {
			const asset = await tx.query.assets.findFirst({
				where: { key: input.imageKey },
				columns: { id: true },
			});
			if (asset != null) {
				ogImageId = asset.id;
			}
		}

		await tx
			.insert(schema.siteMetadata)
			.values({
				id: 1,
				title: input.title,
				description: input.description,
				ogTitle: input.ogTitle,
				ogDescription: input.ogDescription,
				ogImageId,
			})
			.onConflictDoUpdate({
				target: schema.siteMetadata.id,
				set: {
					title: input.title,
					description: input.description,
					ogTitle: input.ogTitle,
					ogDescription: input.ogDescription,
					ogImageId,
					updatedAt: sql`NOW()`,
				},
			});

		return { subjectId: "site", successMessage: t("Metadata saved.") };
	},

	async postCommit() {
		await dispatchWebhook({ type: "site-metadata" });
	},
});
