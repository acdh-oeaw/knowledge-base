"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/auth/session";
import {
	type DeleteEmptyContentBlocksResult,
	deleteEmptyContentBlocks,
} from "@/lib/data/content-block-cleanup";
import { dispatchWebhookForAllContent } from "@/lib/webhook/dispatch-webhook";

export async function deleteEmptyContentBlocksAction(
	ids: Array<string>,
): Promise<DeleteEmptyContentBlocksResult> {
	const auditSession = await assertAdmin();

	const result = await deleteEmptyContentBlocks(ids, auditSession.user.id);

	revalidatePath("/[locale]/dashboard/administrator/maintenance", "page");

	if (result.deletedCount > 0) {
		// The blocks may belong to published versions of any content type.
		await dispatchWebhookForAllContent();
	}

	return result;
}
