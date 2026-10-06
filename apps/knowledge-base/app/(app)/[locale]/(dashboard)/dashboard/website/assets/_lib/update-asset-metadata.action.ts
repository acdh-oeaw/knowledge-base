"use server";

import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { getAssetMetadataCacheTags } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/asset-metadata-cache-tags";
import { UpdateAssetMetadataInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/update-asset-metadata.schema";
import { updateAssetMetadata } from "@/lib/data/assets";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateAssetMetadataAction = createMutationAction({
	schema: UpdateAssetMetadataInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "assets" },
	revalidate: "/[locale]/dashboard/website/assets",

	async mutate(tx, input) {
		const t = await getExtracted();
		// The og image is set per locale, so an asset used as any locale's og image affects site
		// metadata.
		const affectsSiteMetadata = await tx
			.select({ id: schema.siteMetadataTranslations.id })
			.from(schema.siteMetadataTranslations)
			.where(eq(schema.siteMetadataTranslations.ogImageId, input.id))
			.limit(1)
			.then((rows) => rows.length > 0);
		await updateAssetMetadata(input);
		return {
			subjectId: input.id,
			successMessage: t("Asset metadata saved."),
			successData: { affectsSiteMetadata },
		};
	},

	async postCommit({ result }) {
		// Alt text, caption and license are embedded wherever the api serves this image.
		await dispatchWebhook({
			tags: getAssetMetadataCacheTags(result.successData?.affectsSiteMetadata === true),
		});
	},
});
