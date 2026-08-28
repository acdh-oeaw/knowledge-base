import type { UnitRelationActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/reverse-unit-relations-section";
import { createDelegatedUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/create-delegated-unit-relation.action";
import { deleteDelegatedUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/delete-delegated-unit-relation.action";
import { endDelegatedUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/end-delegated-unit-relation.action";
import { updateDelegatedUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/update-delegated-unit-relation.action";

/**
 * Delegated, country-scoped unit-relation mutations injected into `ReverseUnitRelationsSection` on
 * the national coordinator's country dashboard. Each authorizes against the institution's
 * `is_located_in` country, so coordinators may manage only partner institutions located in
 * countries they edit.
 */
export const delegatedUnitRelationActions: UnitRelationActions = {
	create: createDelegatedUnitRelationAction,
	update: updateDelegatedUnitRelationAction,
	end: endDelegatedUnitRelationAction,
	delete: deleteDelegatedUnitRelationAction,
};
