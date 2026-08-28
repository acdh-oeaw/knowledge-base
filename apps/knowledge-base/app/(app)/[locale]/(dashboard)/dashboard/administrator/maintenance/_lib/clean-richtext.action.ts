"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/auth/session";
import { type CleanRichTextResult, cleanRichText } from "@/lib/data/richtext-cleanup";

export async function cleanRichTextAction(ids: Array<string>): Promise<CleanRichTextResult> {
	const auditSession = await assertAdmin();

	const result = await cleanRichText(ids, auditSession.user.id);

	revalidatePath("/[locale]/dashboard/administrator/maintenance", "page");

	return result;
}
