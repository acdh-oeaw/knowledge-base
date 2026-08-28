import { findOrganisationalUnitDocumentsBySshocMarketplaceActorId } from "@dariah-eric/database/integrity-service";
import { type ActionState, createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { db } from "@/lib/db";

interface CheckSshocMarketplaceActorIdAvailableParams {
	sshocMarketplaceActorId: number | null;
	/** The document being edited, excluded so re-saving a unit does not conflict with itself. */
	excludeDocumentId?: string;
}

/**
 * Guards the SSHOC marketplace actor id against being assigned to more than one organisational unit
 * document. The id maps a unit onto a single marketplace actor and the sshoc services ingest keys
 * owner/provider service relations off it, so a duplicate would make that mapping ambiguous. There
 * is no database-level unique constraint because the id lives on the versioned unit table (cloned
 * across a document's draft/published versions), so this best-effort check runs in each admin
 * form's `preCheck`, with the `data:audit:sshoc-actor-id` audit as the backstop for any that slip
 * through a concurrent save.
 *
 * Returns an error `ActionState` to short-circuit the action, or `undefined` when the id is unset
 * or free.
 */
export async function checkSshocMarketplaceActorIdAvailable(
	params: CheckSshocMarketplaceActorIdAvailableParams,
): Promise<ActionState | undefined> {
	const { sshocMarketplaceActorId, excludeDocumentId } = params;

	if (sshocMarketplaceActorId == null) {
		return undefined;
	}

	const units = await findOrganisationalUnitDocumentsBySshocMarketplaceActorId(
		db,
		sshocMarketplaceActorId,
	);
	const conflict = units.find((unit) => unit.documentId !== excludeDocumentId);

	if (conflict == null) {
		return undefined;
	}

	const t = await getExtracted();
	const message = t(
		"This SSHOC marketplace actor id is already assigned to another organisational unit.",
	);

	return createActionStateError({
		message,
		validationErrors: { sshocMarketplaceActorId: [message] },
	});
}
