import * as v from "valibot";

/**
 * Ending an appointment: the country role to close, and the date.
 *
 * The counterpart is deliberately not part of the payload — the server re-resolves it from the
 * paired rule, so which governance-body row gets closed can never be steered from the client.
 */
export const EndCountryRoleActionInputSchema = v.object({
	appointmentId: v.pipe(v.string(), v.uuid()),
	end: v.pipe(v.string(), v.isoDate(), v.toDate()),
});
