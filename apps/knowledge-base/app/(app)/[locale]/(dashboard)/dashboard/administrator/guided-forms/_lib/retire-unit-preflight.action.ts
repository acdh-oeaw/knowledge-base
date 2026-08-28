"use server";

import { assertAdmin } from "@/lib/auth/session";
import { type RetireUnitPreflight, getRetireUnitPreflight } from "@/lib/data/wizard-preflight";

/** Read-only: which still-open relations the chosen unit's rules say must be closed with it. */
export async function retireUnitPreflightAction(input: {
	unitDocumentId: string;
	end: string;
}): Promise<RetireUnitPreflight> {
	await assertAdmin();

	return getRetireUnitPreflight(input);
}
