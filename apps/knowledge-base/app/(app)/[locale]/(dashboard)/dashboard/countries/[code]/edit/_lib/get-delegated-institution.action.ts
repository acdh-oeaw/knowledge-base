"use server";

import { assertCanEditCountryInstitution } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/authorize-country-institution-relation";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";

export interface DelegatedInstitutionFields {
	name: string;
	acronym: string | null;
	ror: string | null;
	summary: string | null;
}

/**
 * Loads the current (draft-or-published) metadata of an institution so the delegated edit dialog
 * can prefill its fields. Authorized the same way as the edit itself (institution located in a
 * managed country). Returns `null` when the institution cannot be resolved.
 */
export async function getDelegatedInstitutionAction(
	documentId: string,
): Promise<DelegatedInstitutionFields | null> {
	const { user } = await assertAuthenticated();
	await assertCanEditCountryInstitution(user, documentId);

	const lifecycle = await db.query.documentLifecycle.findFirst({
		where: { documentId },
		columns: { draftId: true, publishedId: true },
	});

	const versionId = lifecycle?.draftId ?? lifecycle?.publishedId;
	if (versionId == null) {
		return null;
	}

	const unit = await db.query.organisationalUnits.findFirst({
		where: { id: versionId },
		columns: { name: true, acronym: true, ror: true, summary: true },
	});

	return unit ?? null;
}
