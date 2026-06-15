"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { documentsPoliciesLifecycleAdapter } from "@/lib/data/documents-policies.lifecycle-adapter";
import { getDocumentVersions } from "@/lib/data/entity-lifecycle";
import { db } from "@/lib/db";
import { eq, inArray, or } from "@/lib/db/sql";
import {
	deleteWebsiteDocument,
	getWebsiteDocumentDescriptorByEntityId,
} from "@/lib/search/website-index";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export async function deleteDocumentOrPolicyAction(documentId: string): Promise<void> {
	const auditSession = await assertAdmin();

	const descriptor = await db.transaction(async (tx) => {
		const entity = await tx.query.entities.findFirst({
			where: { id: documentId },
			columns: { id: true },
		});

		assert(entity, "Document not found.");

		const documentDescriptor = await getWebsiteDocumentDescriptorByEntityId(documentId);

		const { draftId, publishedId } = await getDocumentVersions(tx, documentId);
		const versionIds = [draftId, publishedId].filter((id): id is string => id != null);

		for (const versionId of versionIds) {
			await documentsPoliciesLifecycleAdapter.wipeSubtype(tx, versionId);
		}

		for (const versionId of versionIds) {
			const fieldRows = await tx
				.select({ id: schema.fields.id })
				.from(schema.fields)
				.where(eq(schema.fields.entityVersionId, versionId));

			if (fieldRows.length > 0) {
				const fieldIds = fieldRows.map((f) => f.id);
				await tx
					.delete(schema.contentBlocks)
					.where(inArray(schema.contentBlocks.fieldId, fieldIds));
				await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
			}
		}

		await tx
			.delete(schema.entitiesToResources)
			.where(eq(schema.entitiesToResources.entityId, documentId));

		await tx
			.delete(schema.entitiesToEntities)
			.where(
				or(
					eq(schema.entitiesToEntities.entityId, documentId),
					eq(schema.entitiesToEntities.relatedEntityId, documentId),
				),
			);

		if (versionIds.length > 0) {
			await tx.delete(schema.entityVersions).where(inArray(schema.entityVersions.id, versionIds));
		}

		await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));

		return documentDescriptor;
	});

	after(async () => {
		if (descriptor != null) {
			await deleteWebsiteDocument(descriptor);
		}

		await dispatchWebhook({ type: "documents-policies" });
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "documents_policies",
		subjectId: documentId,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/website/documents-policies", "layout");
}
