"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/auth/session";
import {
	type MergeDuplicateAssetsResult,
	mergeDuplicateAssets,
} from "@/lib/data/asset-deduplication";
import { db } from "@/lib/db";
import { inArray } from "@/lib/db/sql";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export async function mergeDuplicateAssetsAction(
	canonicalId: string,
	staleIds: Array<string>,
): Promise<MergeDuplicateAssetsResult> {
	await assertAdmin();
	// The og image is set per locale, so a stale copy used as any locale's og image affects site
	// metadata.
	const affectsSiteMetadata = await db
		.select({ id: schema.siteMetadataTranslations.id })
		.from(schema.siteMetadataTranslations)
		.where(inArray(schema.siteMetadataTranslations.ogImageId, staleIds))
		.limit(1)
		.then((rows) => rows.length > 0);
	const result = await mergeDuplicateAssets(canonicalId, staleIds);
	revalidatePath("/[locale]/dashboard/administrator/maintenance", "page");
	await dispatchWebhook({
		tags: ["assets", ...(affectsSiteMetadata ? (["site-metadata"] as const) : [])],
	});
	return result;
}
