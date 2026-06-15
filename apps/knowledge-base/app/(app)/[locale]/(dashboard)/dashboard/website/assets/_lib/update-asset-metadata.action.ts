"use server";

import { getExtracted } from "next-intl/server";

import { UpdateAssetMetadataInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/update-asset-metadata.schema";
import { updateAssetMetadata } from "@/lib/data/assets";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateAssetMetadataAction = createMutationAction({
	schema: UpdateAssetMetadataInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "assets" },
	revalidate: "/[locale]/dashboard/website/assets",

	async mutate(_tx, input) {
		const t = await getExtracted();
		await updateAssetMetadata(input);
		return { subjectId: input.id, successMessage: t("Asset metadata saved.") };
	},
});
