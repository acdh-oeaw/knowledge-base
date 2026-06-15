import * as schema from "@acdh-knowledge-base/database/schema";
import type { JSONContent } from "@tiptap/core";

import { getDocumentLifecycleState } from "@/lib/data/entity-lifecycle";
import { db } from "@/lib/db";
import { and, eq } from "@/lib/db/sql";

export interface SelectedDetailVersion {
	hasDraftChanges: boolean;
	publishedId: string | null;
	selectedVersion: "draft" | "published";
	versionId: string;
}

/**
 * Read-only: resolves which version a detail page renders from the lifecycle state and the
 * `?version=` param. Unlike the edit pages it never calls `ensureDraftVersion`, so viewing a
 * published-only entity does not mint a draft. Returns null -> caller should notFound().
 */
export async function resolveSelectedDetailVersion(
	documentId: string,
	version: string | Array<string> | undefined,
): Promise<SelectedDetailVersion | null> {
	const { draftId, hasDraftChanges, publishedId } = await db.transaction((tx) =>
		getDocumentLifecycleState(tx, documentId),
	);

	// The version selector only kicks in when the draft actually diverges from published. Right after
	// publish a draft clone exists with no real changes -> treat as published-only.
	const showVersionSelector = hasDraftChanges && publishedId != null;

	let selectedVersion: "draft" | "published";
	let versionId: string | null;
	if (showVersionSelector) {
		selectedVersion = version === "published" ? "published" : "draft";
		versionId = selectedVersion === "published" ? publishedId : draftId;
	} else if (publishedId != null) {
		selectedVersion = "published";
		versionId = publishedId;
	} else {
		selectedVersion = "draft";
		versionId = draftId;
	}

	if (versionId == null) {
		return null;
	}

	return { hasDraftChanges, publishedId, selectedVersion, versionId };
}

/** Reads a rich-text field's JSON content for one entity version (e.g. "description"/"biography"). */
export async function getRichTextFieldContent(
	versionId: string,
	fieldName: string,
): Promise<JSONContent | null> {
	const [row] = await db
		.select({ content: schema.richTextContentBlocks.content })
		.from(schema.richTextContentBlocks)
		.innerJoin(schema.contentBlocks, eq(schema.richTextContentBlocks.id, schema.contentBlocks.id))
		.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
		.innerJoin(
			schema.entityTypesFieldsNames,
			eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
		)
		.where(
			and(
				eq(schema.fields.entityVersionId, versionId),
				eq(schema.entityTypesFieldsNames.fieldName, fieldName),
			),
		)
		.limit(1);

	return row?.content ?? null;
}
