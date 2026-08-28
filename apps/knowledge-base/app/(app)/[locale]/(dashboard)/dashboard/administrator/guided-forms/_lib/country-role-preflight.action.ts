"use server";

import type { WizardPreflight } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-plan";
import { assertAdmin } from "@/lib/auth/session";
import {
	type CountryRoleAppointment,
	type CountryRolePreflightInput,
	type EndCountryRolePreflight,
	type EndCountryRolePreflightInput,
	getCountryRolePreflight,
	getEndCountryRolePreflight,
	getOpenCountryRoleAppointments,
} from "@/lib/data/wizard-preflight";

/** Read-only preview of the two relations the appointment will write. See the wizard for context. */
export async function countryRolePreflightAction(
	input: CountryRolePreflightInput,
): Promise<WizardPreflight> {
	await assertAdmin();

	return getCountryRolePreflight(input);
}

/** The person's still-open country roles, to choose from when ending one. */
export async function openCountryRoleAppointmentsAction(
	personDocumentId: string,
): Promise<Array<CountryRoleAppointment>> {
	await assertAdmin();

	return getOpenCountryRoleAppointments(personDocumentId);
}

/** Read-only preview of the two relations the end date will close. */
export async function endCountryRolePreflightAction(
	input: EndCountryRolePreflightInput,
): Promise<EndCountryRolePreflight> {
	await assertAdmin();

	return getEndCountryRolePreflight(input);
}
