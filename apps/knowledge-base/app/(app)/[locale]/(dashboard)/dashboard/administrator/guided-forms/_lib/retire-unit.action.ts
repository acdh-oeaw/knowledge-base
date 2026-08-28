"use server";

import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { RetireUnitActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/retire-unit.schema";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { inArray } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

/**
 * Closes a unit and everything that depends on it, on one date and in one transaction.
 *
 * `inactiveUnitRelationRules` reports a unit whose own membership has ended while its chairs,
 * members, coordinators, or contacts are still recorded as current. Ending those one by one across
 * several screens is what produces that state; ending them together is the whole point here.
 *
 * Only relations that are still open are touched — an already-ended row keeps the end date it has,
 * which may well be the correct earlier one.
 */
export const retireUnitAction = createMutationAction({
	schema: RetireUnitActionInputSchema,
	requireAdmin: true,
	audit: { action: "close", subjectType: "organisational_units" },
	revalidate: [
		"/[locale]/dashboard/administrator",
		"/[locale]/dashboard/administrator/guided-forms",
	],

	async mutate(tx, input, { user }) {
		const t = await getExtracted();

		let closedUnitRelations = 0;
		let closedPersonRelations = 0;

		if (input.unitRelationIds.length > 0) {
			const rows = await tx.query.organisationalUnitsRelations.findMany({
				where: { id: { in: input.unitRelationIds } },
				columns: { id: true, duration: true },
			});

			for (const row of rows) {
				if (row.duration.end != null) {
					continue;
				}

				await tx
					.update(schema.organisationalUnitsRelations)
					.set({ duration: { start: row.duration.start, end: input.end } })
					.where(inArray(schema.organisationalUnitsRelations.id, [row.id]));

				await recordAuditEvent(tx, {
					actorUserId: user.id,
					action: "relation_end",
					subjectType: "end_unit_relation",
					subjectId: row.id,
					summary: { end: input.end, via: "wizard:retire-unit" },
				});

				closedUnitRelations += 1;
			}
		}

		if (input.personRelationIds.length > 0) {
			const rows = await tx.query.personsToOrganisationalUnits.findMany({
				where: { id: { in: input.personRelationIds } },
				columns: { id: true, duration: true },
			});

			for (const row of rows) {
				if (row.duration.end != null) {
					continue;
				}

				await tx
					.update(schema.personsToOrganisationalUnits)
					.set({ duration: { start: row.duration.start, end: input.end } })
					.where(inArray(schema.personsToOrganisationalUnits.id, [row.id]));

				await recordAuditEvent(tx, {
					actorUserId: user.id,
					action: "relation_end",
					subjectType: "end_contribution",
					subjectId: row.id,
					summary: { end: input.end, via: "wizard:retire-unit" },
				});

				closedPersonRelations += 1;
			}
		}

		return {
			subjectId: input.unitDocumentId,
			auditSummary: {
				closedPersonRelations,
				closedUnitRelations,
				end: input.end,
				via: "wizard:retire-unit",
			},
			successMessage: t("{count} relations have been ended.", {
				count: String(closedUnitRelations + closedPersonRelations),
			}),
			successData: { closedPersonRelations, closedUnitRelations },
		};
	},

	async postCommit() {
		await dispatchWebhook({ type: "persons" });
		await dispatchWebhook({ type: "members-partners" });
	},
});
