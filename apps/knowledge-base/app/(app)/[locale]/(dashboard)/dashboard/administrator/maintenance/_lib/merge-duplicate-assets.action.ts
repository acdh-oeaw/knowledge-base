"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/auth/session";
import {
	type MergeDuplicateAssetsResult,
	mergeDuplicateAssets,
} from "@/lib/data/asset-deduplication";

export async function mergeDuplicateAssetsAction(
	canonicalId: string,
	staleIds: Array<string>,
): Promise<MergeDuplicateAssetsResult> {
	await assertAdmin();
	const result = await mergeDuplicateAssets(canonicalId, staleIds);
	revalidatePath("/[locale]/dashboard/administrator/maintenance", "page");
	return result;
}
