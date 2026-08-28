import { isNonEmptyString } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import type { Database, Transaction } from "@/lib/db";

type AuditLogClient = Database | Transaction;

export type AuditLogAction = (typeof schema.auditLogActionEnum)[number];

export interface RecordAuditEventInput {
	actorUserId?: string | null;
	/**
	 * The admin who was impersonating `actorUserId`, if any. Set by the action wrappers from the
	 * session; manual callers only need it if they record events outside a wrapper.
	 */
	impersonatedByUserId?: string | null;
	action: AuditLogAction;
	subjectType: string;
	subjectId: string;
	/**
	 * Optional snapshot of the subject's human-readable label. Action wrappers populate this from the
	 * active transaction when possible, so audit rows stay readable even if the subject is later
	 * renamed or deleted. Manual callers should pass it when they already have the event-time label.
	 */
	subjectLabel?: string | null;
	summary?: Record<string, unknown>;
}

export async function recordAuditEvent(
	client: AuditLogClient,
	input: RecordAuditEventInput,
): Promise<void> {
	const {
		action,
		actorUserId = null,
		impersonatedByUserId = null,
		subjectId,
		subjectType,
		subjectLabel = null,
		summary = {},
	} = input;

	await client.insert(schema.auditLogs).values({
		action,
		actorUserId,
		impersonatedByUserId,
		subjectId,
		subjectType,
		subjectLabel,
		summary,
	});
}

/**
 * Derives the form-supplied part of an audit summary. Deliberately does NOT list the submitted
 * field names: every submit posts the whole form, so a field list is a constant that reads like a
 * changeset without being one. We only carry `intent` (which submit button / sub-action was used);
 * the meaningful "what happened" signal (e.g. `lifecycle: draft | published`) is added by each
 * action via its own `auditSummary`. See `formatAuditSummary` for how this is rendered.
 */
export function getAuditSummaryFromFormData(formData: FormData): Record<string, unknown> {
	const intent = formData.get("intent");
	return isNonEmptyString(intent) ? { intent } : {};
}
