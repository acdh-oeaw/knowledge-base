"use server";

import { getExtracted } from "next-intl/server";

import { UpdateAssetMetadataInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/update-asset-metadata.schema";
import { updateAssetMetadata } from "@/lib/data/assets";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook, getAssetCacheTags } from "@/lib/webhook/dispatch-webhook";

export const updateAssetMetadataAction = createMutationAction({
	schema: UpdateAssetMetadataInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "assets" },
	revalidate: "/[locale]/dashboard/website/assets",

	async mutate(tx, input) {
		const t = await getExtracted();
		const cacheTags = await getAssetCacheTags(tx, [input.id]);
		await updateAssetMetadata(input);
		return {
			subjectId: input.id,
			successMessage: t("Asset metadata saved."),
			successData: { cacheTags },
		};
	},

	async postCommit({ result }) {
		// Alt text, caption and license are embedded wherever the api serves this image.
		await dispatchWebhook({ tags: result.successData?.cacheTags ?? [] });
	},
});
