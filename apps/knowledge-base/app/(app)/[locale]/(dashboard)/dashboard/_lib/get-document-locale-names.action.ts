"use server";

import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";

import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { asc, desc, eq } from "@/lib/db/sql";

/**
 * Names of the locales `documentId` has a version in, default locale first. A delete removes the
 * document in all of them, so the delete dialog names them when there is more than one.
 */
export async function getDocumentLocaleNamesAction(documentId: string): Promise<Array<string>> {
	await assertAdmin();

	if (!v.is(v.pipe(v.string(), v.uuid()), documentId)) {
		return [];
	}

	const rows = await db
		.selectDistinct({ name: schema.locales.name, isDefault: schema.locales.isDefault })
		.from(schema.entityVersions)
		.innerJoin(schema.locales, eq(schema.locales.id, schema.entityVersions.localeId))
		.where(eq(schema.entityVersions.entityId, documentId))
		.orderBy(desc(schema.locales.isDefault), asc(schema.locales.name));

	return rows.map((row) => row.name);
}
