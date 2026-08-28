import type { ReactNode } from "react";

import { CountryMembershipCheck } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/country-membership-check";
import { getCountryMembershipFindings } from "@/lib/data/data-integrity";

export async function CountryMembershipSection(): Promise<ReactNode> {
	const result = await getCountryMembershipFindings();

	return <CountryMembershipCheck result={result} />;
}
