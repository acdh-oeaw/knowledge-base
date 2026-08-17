import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { getLocale } from "next-intl/server";

import { db } from "@/lib/db";
import { and, eq, inArray, sql } from "@/lib/db/sql";
import { redirect } from "@/lib/navigation/navigation";

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

async function hasActiveRelation(
	personDocumentId: string,
	orgUnitDocumentId: string,
	roleTypes: ReadonlyArray<(typeof schema.personRoleTypesEnum)[number]>,
): Promise<boolean> {
	// The user's person actor and the report's org-unit target are both document ids now, matching the
	// relation table directly.
	const rows = await db
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

export async function can(user: User, action: Action, resource: Resource): Promise<boolean> {
	if (user.role === "admin") {
		return true;
	}

	if (resource.type === "organisational_unit") {
		if (action !== "update") {
			return false;
		}
		if (user.personDocumentId == null) {
			return false;
		}
		return hasActiveRelation(user.personDocumentId, resource.id, chairRoles);
	}

	if (resource.type === "working_group_report") {
		if (action !== "read" && action !== "update" && action !== "confirm") {
			return false;
		}
		if (user.personDocumentId == null) {
			return false;
		}

		const report = await db.query.workingGroupReports.findFirst({
			where: { id: resource.id },
			columns: { workingGroupDocumentId: true },
		});
		if (report == null) {
			return false;
		}

		if (action === "confirm") {
			return hasActiveRelation(user.personDocumentId, report.workingGroupDocumentId, chairRoles);
		}

		return (
			(await hasActiveRelation(user.personDocumentId, report.workingGroupDocumentId, chairRoles)) ||
			hasActiveRelation(user.personDocumentId, report.workingGroupDocumentId, memberRoles)
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (resource.type === "country_report") {
		if (action !== "read" && action !== "update" && action !== "confirm") {
			return false;
		}

		const report = await db.query.countryReports.findFirst({
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
			return hasActiveRelation(user.personDocumentId, report.countryDocumentId, coordinatorRoles);
		}

		// `national_coordination_staff` may read and edit country reports, but not confirm them.
		return (
			(await hasActiveRelation(
				user.personDocumentId,
				report.countryDocumentId,
				coordinatorRoles,
			)) ||
			(await hasActiveRelation(
				user.personDocumentId,
				report.countryDocumentId,
				coordinationStaffRoles,
			)) ||
			hasActiveRelation(user.personDocumentId, report.countryDocumentId, representativeRoles)
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
