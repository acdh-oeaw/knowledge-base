import * as schema from "@dariah-eric/database/schema";

import { type EntityLifecycleAdapter, subtypePayload } from "@/lib/data/entity-lifecycle";
import type { Transaction } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export const newsLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(
		tx: Transaction,
		sourceVersionId: string,
		targetVersionId: string,
	): Promise<void> {
		const [source] = await tx
			.select()
			.from(schema.news)
			.where(eq(schema.news.id, sourceVersionId))
			.limit(1);

		if (source == null) {
			return;
		}

		await tx.insert(schema.news).values({ id: targetVersionId, ...subtypePayload(source) });
	},

	async wipeSubtype(tx: Transaction, versionId: string): Promise<void> {
		await tx.delete(schema.news).where(eq(schema.news.id, versionId));
	},
};
