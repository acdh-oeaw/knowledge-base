/**
 * Formats a relation/role status type enum value for display (e.g. "is_partner_of" -> "is partner
 * of").
 */
export function formatRoleType(type: string): string {
	return type.replaceAll("_", " ");
}
