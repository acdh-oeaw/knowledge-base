import type { ReactNode } from "react";

import { MutuallyExclusiveRelationsCheck } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/mutually-exclusive-relations-check";
import { getMutuallyExclusiveUnitRelationFindings } from "@/lib/data/data-integrity";

export async function MutuallyExclusiveRelationsSection(): Promise<ReactNode> {
	const result = await getMutuallyExclusiveUnitRelationFindings();

	return <MutuallyExclusiveRelationsCheck result={result} />;
}
