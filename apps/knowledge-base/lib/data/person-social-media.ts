import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import type { Database, Transaction } from "@/lib/db";
import { eq, inArray } from "@/lib/db/sql";
import type { PersonSocialMediaEntryInput } from "@/lib/person-social-media-input";

/**
 * Reconcile a person version's own social media, persisting the submitted order as `position`.
 *
 * Unlike the social-media join tables — whose rows are diffed so `created_at` survives a reorder —
 * these rows are replaced wholesale: nothing references `person_social_media.id`, and an entry has
 * no identity beyond its url, so there is nothing for a diff to preserve.
 */
export async function syncPersonSocialMedia(
	tx: Transaction,
	personVersionId: string,
	entries: Array<PersonSocialMediaEntryInput>,
): Promise<void> {
	await tx
		.delete(schema.personSocialMedia)
		.where(eq(schema.personSocialMedia.personId, personVersionId));

	if (entries.length === 0) {
		return;
	}

	const types = await tx
		.select({ id: schema.personSocialMediaTypes.id, type: schema.personSocialMediaTypes.type })
		.from(schema.personSocialMediaTypes)
		.where(
			inArray(
				schema.personSocialMediaTypes.type,
				entries.map((entry) => entry.type),
			),
		);
	const typeIdByName = new Map(types.map((type) => [type.type, type.id] as const));

	await tx.insert(schema.personSocialMedia).values(
		entries.map((entry, position) => {
			const typeId = typeIdByName.get(entry.type);
			assert(typeId, `Person social media type "${entry.type}" is not seeded.`);

			return {
				label: entry.label,
				personId: personVersionId,
				position,
				typeId,
				url: entry.url,
			};
		}),
	);
}

export interface PersonSocialMediaEntry {
	type: (typeof schema.personSocialMediaTypesEnum)[number];
	url: string;
	label: string | null;
}

/** A person version's own social media, in their stored order. */
export async function getPersonSocialMedia(
	db: Database | Transaction,
	personVersionId: string,
): Promise<Array<PersonSocialMediaEntry>> {
	const rows = await db.query.personSocialMedia.findMany({
		where: { personId: personVersionId },
		columns: { url: true, label: true },
		with: { type: { columns: { type: true } } },
		orderBy: { position: "asc" },
	});

	return rows.map((row) => {
		return { label: row.label, type: row.type.type, url: row.url };
	});
}
