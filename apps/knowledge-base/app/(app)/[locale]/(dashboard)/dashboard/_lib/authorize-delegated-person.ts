import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { getLocale } from "next-intl/server";

import { can } from "@/lib/auth/permissions";
import { type Database, type Transaction, db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { redirect } from "@/lib/navigation/navigation";

/**
 * Authorize a delegated edit of a person's own metadata. A non-admin may edit a person only when
 * that person holds a relation to an organisational unit the caller is scoped to edit (`can
 * update`) — i.e. the person appears in the people list of a unit they manage. Edits are saved as
 * drafts, so admin review still gates publication. Admins always pass; redirects to `/dashboard`
 * otherwise (mirrors `assertCan`). `executor` defaults to the shared `db`; tests pass a
 * transaction.
 */
export async function assertCanEditPerson(
	user: User,
	personDocumentId: string,
	executor: Database | Transaction = db,
): Promise<void> {
	if (user.role === "admin") {
		return;
	}

	const relations = await executor
		.selectDistinct({
			documentId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
		})
		.from(schema.personsToOrganisationalUnits)
		.where(eq(schema.personsToOrganisationalUnits.personDocumentId, personDocumentId));

	const canEditSomeUnit = (
		await Promise.all(
			relations.map((relation) =>
				can(user, "update", { type: "organisational_unit", id: relation.documentId }, executor),
			),
		)
	).some(Boolean);

	if (!canEditSomeUnit) {
		const locale = await getLocale();
		redirect({ href: "/dashboard", locale });
	}
}
