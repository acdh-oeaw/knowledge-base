import type { useExtracted } from "next-intl";

import type { CompensationRole } from "@/lib/data/report-contributions";

type Translate = ReturnType<typeof useExtracted>;

/** Human label for a compensation role. Pure (takes `t`), so it is usable from any client form. */
export function getCompensationRoleLabel(
	t: Translate,
	role: CompensationRole | null,
): string | null {
	switch (role) {
		case "national_coordinator": {
			return t("National coordinator");
		}
		case "national_coordinator_deputy": {
			return t("National coordinator (deputy)");
		}
		case "is_chair_of_jrc": {
			return t("JRC chair");
		}
		case "is_chair_of_ncc": {
			return t("NCC chair");
		}
		case "is_chair_of_wg": {
			return t("Working group chair");
		}
		case "is_member_of_jrc": {
			return t("JRC member");
		}
		case null: {
			return null;
		}
		default: {
			return null;
		}
	}
}
