import type { OrganisationalUnitType } from "@/lib/data/organisational-units";

/**
 * DARIAH-EU (the ERIC) is a singleton organisational unit of type `eric` and the target of most
 * unit↔unit relations. These are the source unit types whose relations point at it, each surfaced
 * as its own reverse-relation tab.
 *
 * Kept free of server-only imports (db/pg) so client components can use the constant; the only
 * import is type-only and therefore erased at build time.
 */
export const ericReverseRelationSourceTypes = [
	"country",
	"institution",
	"working_group",
	"governance_body",
] as const satisfies ReadonlyArray<OrganisationalUnitType>;

export type EricReverseRelationSourceType = (typeof ericReverseRelationSourceTypes)[number];
