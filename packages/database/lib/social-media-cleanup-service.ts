import { eq, inArray } from "drizzle-orm";

import { getReferencedIds } from "./cleanup-references";
import type { Database, Transaction } from "./index";
import * as schema from "./schema";

/**
 * Detects and removes social-media entries which are not referenced by any foreign key — no
 * project, organisational unit, service, or report links to them. Unlike assets, social-media rows
 * are only ever linked by id (never embedded in rich text), so a foreign-key check is exhaustive.
 * The referencing columns are discovered from the Postgres catalog, so a new link table is covered
 * automatically. Shared by the `@dariah-eric/maintenance` cli and the admin dashboard.
 */

/** JSON-serializable so findings can cross a server/client boundary. */
export interface UnusedSocialMedia {
	id: string;
	type: string;
	name: string;
	url: string;
}

export interface UnusedSocialMediaResult {
	items: Array<UnusedSocialMedia>;
	total: number;
}

export async function findUnusedSocialMedia(
	db: Database | Transaction,
): Promise<UnusedSocialMediaResult> {
	const referencedIds = await getReferencedIds(db, "social_media");

	const rows = await db
		.select({
			id: schema.socialMedia.id,
			type: schema.socialMediaTypes.type,
			name: schema.socialMedia.name,
			url: schema.socialMedia.url,
		})
		.from(schema.socialMedia)
		.innerJoin(schema.socialMediaTypes, eq(schema.socialMediaTypes.id, schema.socialMedia.typeId));

	const items = rows
		.filter((row) => !referencedIds.has(row.id))
		.toSorted(
			(a, b) =>
				a.type.localeCompare(b.type) ||
				a.name.localeCompare(b.name) ||
				a.url.localeCompare(b.url) ||
				a.id.localeCompare(b.id),
		);

	return { items, total: items.length };
}

export interface DeleteUnusedSocialMediaOptions {
	/** Recorded as the actor of the `delete` audit events; `null` for system/cli runs. */
	actorUserId?: string | null;
}

export interface DeleteUnusedSocialMediaResult {
	deletedCount: number;
	/** Ids requested but not deleted because they are no longer unused or no longer exist. */
	skippedIds: Array<string>;
}

/**
 * Deletes the given social-media entries, but only those which are _still_ unused at call time —
 * the unused set is recomputed here rather than trusting the caller's ids, so a link added in the
 * meantime protects the entry.
 */
export async function deleteUnusedSocialMedia(
	db: Database | Transaction,
	ids: Array<string>,
	options: DeleteUnusedSocialMediaOptions = {},
): Promise<DeleteUnusedSocialMediaResult> {
	const { actorUserId = null } = options;

	const requested = new Set(ids);
	const { items } = await findUnusedSocialMedia(db);
	const deletable = items.filter((item) => requested.has(item.id));
	const deletableIds = new Set(deletable.map((item) => item.id));
	const skippedIds = ids.filter((id) => !deletableIds.has(id));

	if (deletable.length === 0) {
		return { deletedCount: 0, skippedIds };
	}

	await db.transaction(async (tx) => {
		await tx.delete(schema.socialMedia).where(inArray(schema.socialMedia.id, [...deletableIds]));
		await tx.insert(schema.auditLogs).values(
			deletable.map((item) => {
				return {
					action: "delete" as const,
					actorUserId,
					subjectType: "social_media",
					subjectId: item.id,
					summary: { type: item.type, name: item.name, url: item.url },
				};
			}),
		);
	});

	return { deletedCount: deletable.length, skippedIds };
}
