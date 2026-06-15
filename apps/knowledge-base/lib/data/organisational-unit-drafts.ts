import { assert } from "@acdh-oeaw/lib";

import { ensureDraftVersion } from "@/lib/data/entity-lifecycle";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import type { Transaction } from "@/lib/db";

export async function ensureOrganisationalUnitDraftVersion(
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
	assert(version, `Organisational unit version "${versionId}" not found.`);

	if (version.status.type === "draft") {
		return versionId;
	}

	return ensureDraftVersion(tx, version.entity.id, organisationalUnitsLifecycleAdapter);
}
