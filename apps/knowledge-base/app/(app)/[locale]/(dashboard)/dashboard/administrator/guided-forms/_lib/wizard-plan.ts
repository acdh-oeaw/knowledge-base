import type { RelationInterval } from "@/lib/data/data-integrity";

/**
 * What a guided form will do when it is submitted, and why.
 *
 * Everything here crosses the server/client boundary: the preflight assembles it on the server (it
 * needs the database to know what already exists), the review step renders it in the browser. It is
 * therefore JSON-serializable throughout — dates are ISO strings, exactly as `RelationInterval`
 * already is for the maintenance findings.
 *
 * Rows carry codes and resolved names rather than finished sentences, so the review step can phrase
 * them in the viewer's locale.
 */

export type WizardPlanItemStatus =
	/** The row does not exist yet and will be inserted. */
	| "create"
	/** The row exists but does not match; submitting adjusts it. */
	| "update"
	/** The row already exists as required; submitting leaves it alone. */
	| "skip";

interface WizardPlanItemBase {
	id: string;
	status: WizardPlanItemStatus;
}

export interface WizardEntityPlanItem extends WizardPlanItemBase {
	kind: "entity";
	entityType: "institution" | "person";
	name: string;
	/** Whether the new document will be published, or left as a draft for later editing. */
	lifecycle: "draft" | "published";
}

export interface WizardUnitRelationPlanItem extends WizardPlanItemBase {
	kind: "unit_relation";
	unitName: string;
	/** An `organisationalUnitStatusEnum` value, e.g. `is_located_in`. */
	relationType: string;
	relatedUnitName: string;
	start: string;
	end: string | null;
}

export interface WizardPersonRelationPlanItem extends WizardPlanItemBase {
	kind: "person_relation";
	personName: string;
	/** A `personRoleTypesEnum` value, e.g. `national_coordinator`. */
	roleType: string;
	unitName: string;
	start: string;
	end: string | null;
}

export type WizardPlanItem =
	| WizardEntityPlanItem
	| WizardPersonRelationPlanItem
	| WizardUnitRelationPlanItem;

export type WizardWarningCode =
	/** A partner status was chosen for an institution in a country which is not a DARIAH-EU member. */
	| "country_not_member"
	/** Cooperating-partner status was chosen for an institution in a member/observer country. */
	| "country_is_member"
	/** The chosen relation already implies another, which is therefore not offered. */
	| "relation_implies_other"
	/** The chosen relation contradicts one the unit already holds. */
	| "relation_conflicts"
	/** The paired counterpart exists, but over a different period. */
	| "counterpart_duration_mismatch"
	/** The paired counterpart already exists and matches; its row will be skipped. */
	| "counterpart_present"
	/** Ending an appointment, but the governance-body relation it pairs with is not open. */
	| "counterpart_absent"
	/** The counterpart began after the chosen end date, so ending it would invert its period. */
	| "counterpart_starts_after_end"
	/** The chosen end date falls before the appointment started. */
	| "end_before_start";

export interface WizardWarning {
	id: string;
	severity: "info" | "warning";
	code: WizardWarningCode;
	/** Name of the `integrity-service` rule this derives from, so it can be looked up. */
	rule: string;
	/** Resolved names the message interpolates, e.g. `{ country: "Austria" }`. */
	values: Record<string, string>;
	/** The periods the warning applies to, for the duration-sensitive rules. */
	periods?: Array<RelationInterval>;
}

export interface WizardPreflight {
	items: Array<WizardPlanItem>;
	warnings: Array<WizardWarning>;
}

/** True when submitting would write nothing — every planned row already exists as required. */
export function isPreflightEmpty(preflight: WizardPreflight): boolean {
	return preflight.items.every((item) => item.status === "skip");
}
