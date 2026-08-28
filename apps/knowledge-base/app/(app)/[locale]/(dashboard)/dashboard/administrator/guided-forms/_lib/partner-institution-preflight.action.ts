"use server";

import type { WizardPreflight } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-plan";
import { assertAdmin } from "@/lib/auth/session";
import {
	type PartnerInstitutionPreflightInput,
	getPartnerInstitutionPreflight,
} from "@/lib/data/wizard-preflight";

/**
 * Read-only: shows the admin what the submit would write, and what the data-integrity rules make of
 * it, before anything is saved. Called when the wizard reaches its review step, and again whenever
 * an earlier answer changes.
 */
export async function partnerInstitutionPreflightAction(
	input: PartnerInstitutionPreflightInput,
): Promise<WizardPreflight> {
	await assertAdmin();

	return getPartnerInstitutionPreflight(input);
}
