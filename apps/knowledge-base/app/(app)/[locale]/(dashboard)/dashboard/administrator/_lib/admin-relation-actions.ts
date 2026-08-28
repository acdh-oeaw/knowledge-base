import type { PersonRelationActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/person-relations-section";
import type { UnitRelationActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/reverse-unit-relations-section";
import { createContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-contribution.action";
import { createUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-unit-relation.action";
import { deleteUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/delete-unit-relation.action";
import { endContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/end-contribution.action";
import { endUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/end-unit-relation.action";
import { updateContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/update-contribution.action";
import { updateUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/update-unit-relation.action";
import { deleteContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/contributions/_lib/delete-contribution.action";

/**
 * Person-relation mutations injected into `PersonRelationsSection`. These actions are
 * scope-authorized (`assertCan(update, <unit>)`), so the same bundle serves admin edit forms and
 * the delegated non-admin dashboards — admins always pass, non-admins pass only for units they are
 * scoped to edit.
 */
export const personRelationActions: PersonRelationActions = {
	create: createContributionAction,
	update: updateContributionAction,
	end: endContributionAction,
	delete: deleteContributionAction,
};

/** Admin (`requireAdmin`) unit-relation mutations, injected into the unit-relation sections. */
export const adminUnitRelationActions: UnitRelationActions = {
	create: createUnitRelationAction,
	update: updateUnitRelationAction,
	end: endUnitRelationAction,
	delete: deleteUnitRelationAction,
};
