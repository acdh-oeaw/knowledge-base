import type { ReactNode } from "react";

import { HeadingHierarchyCheck } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/heading-hierarchy-check";
import { getHeadingHierarchyFindings } from "@/lib/data/data-integrity";

export async function HeadingHierarchySection(): Promise<ReactNode> {
	const result = await getHeadingHierarchyFindings();

	return <HeadingHierarchyCheck result={result} />;
}
