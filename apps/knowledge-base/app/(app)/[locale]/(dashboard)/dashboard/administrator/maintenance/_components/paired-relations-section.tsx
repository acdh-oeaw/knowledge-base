import type { ReactNode } from "react";

import { PairedRelationsCheck } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/paired-relations-check";
import { getDataIntegrityFindings } from "@/lib/data/data-integrity";

export async function PairedRelationsSection(): Promise<ReactNode> {
	const result = await getDataIntegrityFindings();

	return <PairedRelationsCheck result={result} />;
}
