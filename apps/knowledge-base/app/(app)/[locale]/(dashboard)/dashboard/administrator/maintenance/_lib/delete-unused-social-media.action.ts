"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/auth/session";
import {
	type DeleteUnusedSocialMediaResult,
	deleteUnusedSocialMedia,
} from "@/lib/data/social-media-cleanup";

export async function deleteUnusedSocialMediaAction(
	ids: Array<string>,
): Promise<DeleteUnusedSocialMediaResult> {
	const auditSession = await assertAdmin();

	const result = await deleteUnusedSocialMedia(ids, auditSession.user.id);

	revalidatePath("/[locale]/dashboard/administrator/maintenance", "page");

	return result;
}
