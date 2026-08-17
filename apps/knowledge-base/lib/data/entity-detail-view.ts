import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";

import {
	getDocumentLifecycleState,
	getDocumentLifecycleStateForLocale,
} from "@/lib/data/entity-lifecycle";
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
 * published-only entity does not mint a draft. Returns null -> caller should notFound() (or, for a
 * non-default `localeId`, show a "not translated yet" state instead — a null result there just
 * means the document has no version in that locale).
 *
 * `localeId` defaults to whatever `document_lifecycle` is pinned to (the default locale). Pass an
 * explicit locale id to resolve a document's version in another locale instead.
 */
export async function resolveSelectedDetailVersion(
	documentId: string,
	version: string | Array<string> | undefined,
	localeId?: string,
): Promise<SelectedDetailVersion | null> {
	const { draftId, hasDraftChanges, publishedId } = await db.transaction((tx) =>
		localeId != null
			? getDocumentLifecycleStateForLocale(tx, documentId, localeId)
			: getDocumentLifecycleState(tx, documentId),
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

export interface LocalizedDetailVersion extends SelectedDetailVersion {
	/** The locale actually being displayed — equals `selectedLocaleId` unless `isLocaleFallback`. */
	displayLocaleId: string;
	/** True when `selectedLocaleId` had no version and this fell back to the default locale. */
	isLocaleFallback: boolean;
}

/**
 * {@link resolveSelectedDetailVersion}, but when the selected locale has no version, falls back to
 * the default locale instead of returning null — so a detail page can show default-language content
 * (clearly marked as untranslated) rather than a dead end. Still returns null if neither locale has
 * a version, which only happens for a genuinely broken/empty document.
 */
export async function resolveLocalizedDetailVersion(
	documentId: string,
	version: string | Array<string> | undefined,
	locales: ReadonlyArray<{ id: string; isDefault: boolean }>,
	selectedLocaleId: string,
): Promise<LocalizedDetailVersion | null> {
	const versionState = await resolveSelectedDetailVersion(documentId, version, selectedLocaleId);

	if (versionState != null) {
		return { ...versionState, displayLocaleId: selectedLocaleId, isLocaleFallback: false };
	}

	const defaultLocale = locales.find((locale) => locale.isDefault);

	if (defaultLocale == null || defaultLocale.id === selectedLocaleId) {
		return null;
	}

	const fallbackVersionState = await resolveSelectedDetailVersion(
		documentId,
		version,
		defaultLocale.id,
	);

	if (fallbackVersionState == null) {
		return null;
	}

	return { ...fallbackVersionState, displayLocaleId: defaultLocale.id, isLocaleFallback: true };
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
