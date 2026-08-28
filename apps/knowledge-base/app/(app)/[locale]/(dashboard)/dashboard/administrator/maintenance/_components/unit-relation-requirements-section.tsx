import type { ReactNode } from "react";

import { UnitRelationRequirementsCheck } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/unit-relation-requirements-check";
import { getUnitRelationRequirementFindings } from "@/lib/data/data-integrity";

export async function UnitRelationRequirementsSection(): Promise<ReactNode> {
	const result = await getUnitRelationRequirementFindings();

	return <UnitRelationRequirementsCheck result={result} />;
}
