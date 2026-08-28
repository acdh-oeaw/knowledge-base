"use server";

import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { EndCountryRoleActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/end-country-role.schema";
import {
	type CountryRoleType,
	countryRoleRuleByRoleType,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-registry";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import {
	getExistingPersonRelations,
	resolveOpenCounterpartToEnd,
} from "@/lib/data/wizard-preflight";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { UserFacingError } from "@/lib/user-facing-error";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

/**
 * Ends a country role and the governance-body seat that came with it, on the same date and in one
 * transaction — the inverse of `createCountryRoleAction`.
 *
 * Ending only the appointment leaves the person recorded as a sitting member of the National
 * Coordinator Committee or the General Assembly indefinitely, which `pairedRelationRules` reports
 * as a duration mismatch. It is the easier half to forget: the appointment is the one people go
 * looking for.
 *
 * The counterpart is resolved here rather than taken from the request, so the row that gets closed
 * is always the one the rule points at.
 */
export const endCountryRoleAction = createMutationAction({
	schema: EndCountryRoleActionInputSchema,
	requireAdmin: true,
	audit: { action: "relation_end", subjectType: "end_contribution" },
	revalidate: [
		"/[locale]/dashboard/administrator/persons",
		"/[locale]/dashboard/administrator/guided-forms",
	],

	async mutate(tx, input, { user }) {
		const t = await getExtracted();

		const appointment = await tx.query.personsToOrganisationalUnits.findFirst({
			where: { id: input.appointmentId },
			columns: { id: true, duration: true, personDocumentId: true },
			with: { roleType: { columns: { type: true } } },
		});

		if (appointment == null) {
			throw new UserFacingError("missing-paired-relation-unit");
		}

		const roleType = appointment.roleType.type as CountryRoleType;

		// Guard both ends of the range: Postgres rejects an inverted period outright, and an already
		// closed appointment is not something this flow should silently re-date.
		if (!(roleType in countryRoleRuleByRoleType) || appointment.duration.end != null) {
			throw new UserFacingError("relation-not-endable");
		}

		if (input.end <= appointment.duration.start) {
			throw new UserFacingError("relation-end-before-start");
		}

		await tx
			.update(schema.personsToOrganisationalUnits)
			.set({ duration: { start: appointment.duration.start, end: input.end } })
			.where(eq(schema.personsToOrganisationalUnits.id, appointment.id));

		await recordAuditEvent(tx, {
			actorUserId: user.id,
			action: "relation_end",
			subjectType: "end_contribution",
			subjectId: appointment.id,
			summary: { end: input.end, role: roleType, via: "wizard:country-role-end" },
		});

		// Re-resolve inside the transaction: the preflight the admin reviewed is a snapshot, and the
		// counterpart may have been closed in the meantime.
		const existing = await getExistingPersonRelations(tx, appointment.personDocumentId);
		const counterpart = await resolveOpenCounterpartToEnd(tx, roleType, existing);

		let didEndCounterpart = false;

		// An open counterpart that began after the end date would be inverted by it; the preflight
		// warns about that case and it is left for the admin to sort out by hand.
		if (counterpart != null && counterpart.start < input.end) {
			await tx
				.update(schema.personsToOrganisationalUnits)
				.set({ duration: { start: counterpart.start, end: input.end } })
				.where(eq(schema.personsToOrganisationalUnits.id, counterpart.relationId));

			await recordAuditEvent(tx, {
				actorUserId: user.id,
				action: "relation_end",
				subjectType: "end_contribution",
				subjectId: counterpart.relationId,
				summary: {
					end: input.end,
					role: counterpart.roleType,
					rule: counterpart.rule,
					reason: "paired with the country role being ended",
					via: "wizard:country-role-end",
				},
			});

			didEndCounterpart = true;
		}

		return {
			subjectId: appointment.id,
			auditSummary: { didEndCounterpart, end: input.end, via: "wizard:country-role-end" },
			successMessage: didEndCounterpart
				? t("The appointment and its governance-body membership have been ended.")
				: t("The appointment has been ended."),
			successData: { didEndCounterpart },
		};
	},

	async postCommit() {
		await dispatchWebhook({ type: "persons" });
	},
});
