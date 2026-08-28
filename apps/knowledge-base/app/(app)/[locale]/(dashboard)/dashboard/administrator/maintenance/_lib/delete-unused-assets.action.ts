"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/auth/session";
import { type DeleteUnusedAssetsResult, deleteUnusedAssets } from "@/lib/data/asset-cleanup";

export async function deleteUnusedAssetsAction(
	ids: Array<string>,
): Promise<DeleteUnusedAssetsResult> {
	const auditSession = await assertAdmin();

	const result = await deleteUnusedAssets(ids, auditSession.user.id);

	revalidatePath("/[locale]/dashboard/administrator/maintenance", "page");

	return result;
}
