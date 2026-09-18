"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { resolveAuditSubjectLabel } from "@/lib/data/audit-log";
import { documentsPoliciesLifecycleAdapter } from "@/lib/data/documents-policies.lifecycle-adapter";
import { deleteAllDocumentVersions } from "@/lib/data/entity-lifecycle";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import {
	deleteWebsiteDocument,
	getWebsiteDocumentDescriptorByEntityId,
} from "@/lib/search/website-index";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export async function deleteDocumentOrPolicyAction(documentId: string): Promise<void> {
	const auditSession = await assertAdmin();

	// Snapshot the label before the transaction wipes the entity, so the audit log keeps it readable.
	const subjectLabel = await resolveAuditSubjectLabel("documents_policies", documentId);

	const descriptor = await db.transaction(async (tx) => {
		const entity = await tx.query.entities.findFirst({
			where: { id: documentId },
			columns: { id: true },
		});

		assert(entity, "Document not found.");

		const documentDescriptor = await getWebsiteDocumentDescriptorByEntityId(documentId);

		await deleteAllDocumentVersions(tx, documentId, documentsPoliciesLifecycleAdapter);

		await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));

		return documentDescriptor;
	});

	after(async () => {
		if (descriptor != null) {
			await deleteWebsiteDocument(descriptor);
		}

		await dispatchWebhook({ tags: ["documents-policies"] });
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "documents_policies",
		subjectId: documentId,
		subjectLabel,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/website/documents-policies", "layout");
}
