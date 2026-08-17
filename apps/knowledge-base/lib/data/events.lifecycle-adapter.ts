import * as schema from "@dariah-eric/database/schema";

import type { EntityLifecycleAdapter } from "@/lib/data/entity-lifecycle";
import type { Transaction } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export const eventsLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(
		tx: Transaction,
		sourceVersionId: string,
		targetVersionId: string,
	): Promise<void> {
		const [source] = await tx
			.select({
				title: schema.events.title,
				summary: schema.events.summary,
				imageId: schema.events.imageId,
				location: schema.events.location,
				duration: schema.events.duration,
				isFullDay: schema.events.isFullDay,
				website: schema.events.website,
			})
			.from(schema.events)
			.where(eq(schema.events.id, sourceVersionId))
			.limit(1);

		if (source == null) {
			return;
		}

		await tx.insert(schema.events).values({ id: targetVersionId, ...source });
	},

	async wipeSubtype(tx: Transaction, versionId: string): Promise<void> {
		await tx.delete(schema.events).where(eq(schema.events.id, versionId));
	},
};
