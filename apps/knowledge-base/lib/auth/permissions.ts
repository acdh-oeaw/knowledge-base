import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { getLocale } from "next-intl/server";

import { type Database, type Transaction, db } from "@/lib/db";
import { and, eq, inArray, sql } from "@/lib/db/sql";
import { redirect } from "@/lib/navigation/navigation";

/**
 * Read executor for permission checks. Defaults to the shared `db`; tests pass a (rolled-back)
 * transaction so seeded org units / relations are visible to the same checks the app runs.
 */
type Executor = Database | Transaction;

export type Action = "read" | "create" | "update" | "delete" | "confirm";

export type Resource =
	| { type: "organisational_unit"; id: string }
	| { type: "country_report"; id: string }
	| { type: "working_group_report"; id: string };

const chairRoles = ["is_chair_of", "is_vice_chair_of"] as const;
const memberRoles = ["is_member_of"] as const;
const coordinatorRoles = ["national_coordinator", "national_coordinator_deputy"] as const;
const coordinationStaffRoles = ["national_coordination_staff"] as const;
const representativeRoles = ["national_representative", "national_representative_deputy"] as const;
const countryReadRoles = [
	...coordinatorRoles,
	...coordinationStaffRoles,
	...representativeRoles,
] as const;

async function getOrganisationalUnitPermissionTarget(executor: Executor, documentId: string) {
	const unit = await executor
		.select({ type: schema.organisationalUnitTypes.type })
		.from(schema.documentLifecycle)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(eq(schema.documentLifecycle.documentId, documentId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (unit?.type !== "national_consortium") {
		return unit == null ? null : { documentId, type: unit.type };
	}

	const country = await executor
		.select({ documentId: schema.organisationalUnitsRelations.relatedUnitDocumentId })
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.where(
			and(
				eq(schema.organisationalUnitsRelations.unitDocumentId, documentId),
				eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
				sql`${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ`,
			),
		)
		.limit(1)
		.then((rows) => rows[0] ?? null);

	return country == null ? null : { documentId: country.documentId, type: "country" as const };
}

async function hasActiveRelation(
	executor: Executor,
	personDocumentId: string,
	orgUnitDocumentId: string,
	roleTypes: ReadonlyArray<(typeof schema.personRoleTypesEnum)[number]>,
): Promise<boolean> {
	// The user's person actor and the report's org-unit target are both document ids now, matching the
	// relation table directly.
	const rows = await executor
		.select({ id: schema.personsToOrganisationalUnits.id })
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.where(
			and(
				eq(schema.personsToOrganisationalUnits.personDocumentId, personDocumentId),
				eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, orgUnitDocumentId),
				inArray(schema.personRoleTypes.type, roleTypes),
				sql`${schema.personsToOrganisationalUnits.duration} @> NOW()::TIMESTAMPTZ`,
			),
		)
		.limit(1);

	return rows.length > 0;
}

export async function can(
	user: User,
	action: Action,
	resource: Resource,
	executor: Executor = db,
): Promise<boolean> {
	if (user.role === "admin") {
		return true;
	}

	if (resource.type === "organisational_unit") {
		if (action !== "read" && action !== "update") {
			return false;
		}

		const target = await getOrganisationalUnitPermissionTarget(executor, resource.id);
		if (target == null) {
			return false;
		}

		if (target.type === "country") {
			if (action === "read" && user.organisationalUnitDocumentId === target.documentId) {
				return true;
			}
			if (user.personDocumentId == null) {
				return false;
			}
			return hasActiveRelation(
				executor,
				user.personDocumentId,
				target.documentId,
				action === "update" ? coordinatorRoles : countryReadRoles,
			);
		}

		if (target.type !== "working_group") {
			return false;
		}
		if (user.personDocumentId == null) {
			return false;
		}
		return hasActiveRelation(
			executor,
			user.personDocumentId,
			resource.id,
			action === "update" ? chairRoles : [...chairRoles, ...memberRoles],
		);
	}

	if (resource.type === "working_group_report") {
		if (action !== "read" && action !== "update" && action !== "confirm") {
			return false;
		}
		if (user.personDocumentId == null) {
			return false;
		}

		const report = await executor.query.workingGroupReports.findFirst({
			where: { id: resource.id },
			columns: { workingGroupDocumentId: true },
		});
		if (report == null) {
			return false;
		}

		if (action === "confirm") {
			return hasActiveRelation(
				executor,
				user.personDocumentId,
				report.workingGroupDocumentId,
				chairRoles,
			);
		}

		return (
			(await hasActiveRelation(
				executor,
				user.personDocumentId,
				report.workingGroupDocumentId,
				chairRoles,
			)) ||
			hasActiveRelation(executor, user.personDocumentId, report.workingGroupDocumentId, memberRoles)
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (resource.type === "country_report") {
		if (action !== "read" && action !== "update" && action !== "confirm") {
			return false;
		}

		const report = await executor.query.countryReports.findFirst({
			where: { id: resource.id },
			columns: { countryDocumentId: true },
		});
		if (report == null) {
			return false;
		}

		if (
			(action === "read" || action === "update") &&
			user.organisationalUnitDocumentId === report.countryDocumentId
		) {
			// Both the user's country actor and the report's country are document ids.
			return true;
		}

		if (user.personDocumentId == null) {
			return false;
		}

		if (action === "confirm") {
			return hasActiveRelation(
				executor,
				user.personDocumentId,
				report.countryDocumentId,
				coordinatorRoles,
			);
		}

		// `national_coordination_staff` may read and edit country reports, but not confirm them.
		return (
			(await hasActiveRelation(
				executor,
				user.personDocumentId,
				report.countryDocumentId,
				coordinatorRoles,
			)) ||
			(await hasActiveRelation(
				executor,
				user.personDocumentId,
				report.countryDocumentId,
				coordinationStaffRoles,
			)) ||
			hasActiveRelation(
				executor,
				user.personDocumentId,
				report.countryDocumentId,
				representativeRoles,
			)
		);
	}

	return false;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function assertCan(user: User, action: Action, resource: Resource) {
	const allowed = await can(user, action, resource);

	if (!allowed) {
		const locale = await getLocale();
		redirect({ href: "/dashboard", locale });
	}
}

export type ReportResource =
	| { type: "country_report"; id: string }
	| { type: "working_group_report"; id: string };

/**
 * Whether a report's _content_ may be edited right now. Distinct from `can(update)` (who may edit):
 * reporters and NCs may only edit while the report is a `draft` and its campaign is `open`; once it
 * is submitted/accepted (or the campaign closes) editing is frozen. Admins may always edit.
 */
export async function isReportEditable(user: User, resource: ReportResource): Promise<boolean> {
	if (user.role === "admin") {
		return true;
	}

	const report =
		resource.type === "country_report"
			? await db.query.countryReports.findFirst({
					where: { id: resource.id },
					columns: { status: true },
					with: { campaign: { columns: { status: true } } },
				})
			: await db.query.workingGroupReports.findFirst({
					where: { id: resource.id },
					columns: { status: true },
					with: { campaign: { columns: { status: true } } },
				});

	return report?.status === "draft" && report.campaign.status === "open";
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function assertReportEditable(user: User, resource: ReportResource) {
	if (!(await isReportEditable(user, resource))) {
		const locale = await getLocale();
		redirect({ href: "/dashboard", locale });
	}
}
