"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/auth/session";
import {
	type DeleteEmptyContentBlocksResult,
	deleteEmptyContentBlocks,
} from "@/lib/data/content-block-cleanup";

export async function deleteEmptyContentBlocksAction(
	ids: Array<string>,
): Promise<DeleteEmptyContentBlocksResult> {
	const auditSession = await assertAdmin();

	const result = await deleteEmptyContentBlocks(ids, auditSession.user.id);

	revalidatePath("/[locale]/dashboard/administrator/maintenance", "page");

	return result;
}
