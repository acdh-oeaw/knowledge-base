import { assert } from "@acdh-oeaw/lib";

import { ensureDraftVersion } from "@/lib/data/entity-lifecycle";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import type { Transaction } from "@/lib/db";

export async function ensurePersonDraftVersion(
	tx: Transaction,
	versionId: string,
): Promise<string> {
	const version = await tx.query.entityVersions.findFirst({
		where: { id: versionId },
		columns: {},
		with: {
			entity: {
				columns: { id: true },
			},
			status: {
				columns: { type: true },
			},
		},
	});
	assert(version, `Person version "${versionId}" not found.`);

	if (version.status.type === "draft") {
		return versionId;
	}

	return ensureDraftVersion(tx, version.entity.id, personsLifecycleAdapter);
}
