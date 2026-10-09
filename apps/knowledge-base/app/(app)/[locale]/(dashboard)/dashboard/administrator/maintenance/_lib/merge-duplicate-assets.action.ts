"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/auth/session";
import {
	type MergeDuplicateAssetsResult,
	mergeDuplicateAssets,
} from "@/lib/data/asset-deduplication";
import { db } from "@/lib/db";
import { dispatchWebhook, getAssetCacheTags } from "@/lib/webhook/dispatch-webhook";

export async function mergeDuplicateAssetsAction(
	canonicalId: string,
	staleIds: Array<string>,
): Promise<MergeDuplicateAssetsResult> {
	await assertAdmin();
	// Read before the merge re-points them: afterwards nothing references the stale copies.
	const cacheTags = await getAssetCacheTags(db, staleIds);
	const result = await mergeDuplicateAssets(canonicalId, staleIds);
	revalidatePath("/[locale]/dashboard/administrator/maintenance", "page");
	await dispatchWebhook({ tags: cacheTags });
	return result;
}
