import type { ReactNode } from "react";

import { InactiveUnitRelationsCheck } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/inactive-unit-relations-check";
import { getInactiveUnitRelationFindings } from "@/lib/data/data-integrity";

export async function InactiveUnitRelationsSection(): Promise<ReactNode> {
	const result = await getInactiveUnitRelationFindings();

	return <InactiveUnitRelationsCheck result={result} />;
}
