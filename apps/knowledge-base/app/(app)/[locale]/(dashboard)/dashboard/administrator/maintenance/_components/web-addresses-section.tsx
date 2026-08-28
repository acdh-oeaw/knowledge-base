import type { ReactNode } from "react";

import { WebAddressesCheck } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/web-addresses-check";
import { getWebAddressFindings } from "@/lib/data/data-integrity";

export async function WebAddressesSection(): Promise<ReactNode> {
	const result = await getWebAddressFindings();

	return <WebAddressesCheck result={result} />;
}
