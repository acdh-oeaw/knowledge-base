"use server";

import { assertCanEditPerson } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/authorize-delegated-person";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";

export interface DelegatedPersonFields {
	name: string;
	sortName: string;
}

/**
 * Loads the current (draft-or-published) metadata of a person so the delegated edit dialog can
 * prefill its fields. Authorized the same way as the edit itself. Returns `null` when the person
 * cannot be resolved.
 */
export async function getDelegatedPersonAction(
	documentId: string,
): Promise<DelegatedPersonFields | null> {
	const { user } = await assertAuthenticated();
	await assertCanEditPerson(user, documentId);

	const lifecycle = await db.query.documentLifecycle.findFirst({
		where: { documentId },
		columns: { draftId: true, publishedId: true },
	});

	const versionId = lifecycle?.draftId ?? lifecycle?.publishedId;
	if (versionId == null) {
		return null;
	}

	const person = await db.query.persons.findFirst({
		where: { id: versionId },
		columns: { name: true, sortName: true },
	});

	return person ?? null;
}
