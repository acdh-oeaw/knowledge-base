import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { cache } from "react";

import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { and, eq, inArray, or, sql } from "@/lib/db/sql";

export interface UserCountryScope {
	documentId: string;
	name: string;
	slug: string;
	canEdit: boolean;
	nationalConsortium: { documentId: string; name: string; slug: string } | null;
}

export interface UserWorkingGroupScope {
	documentId: string;
	name: string;
	slug: string;
	canEdit: boolean;
}

export interface UserOrganisationalUnitScopes {
	countries: Array<UserCountryScope>;
	workingGroups: Array<UserWorkingGroupScope>;
}

const countryRoles = [
	"national_coordinator",
	"national_coordinator_deputy",
	"national_coordination_staff",
	"national_representative",
	"national_representative_deputy",
] as const;
const workingGroupRoles = ["is_chair_of", "is_vice_chair_of", "is_member_of"] as const;

async function getUserOrganisationalUnitScopesUncached(
	user: User,
): Promise<UserOrganisationalUnitScopes> {
	if (user.role === "admin") {
		return { countries: [], workingGroups: [] };
	}

	const documentIds = new Set<string>();
	if (user.organisationalUnitDocumentId != null) {
		documentIds.add(user.organisationalUnitDocumentId);
	}

	if (user.personDocumentId != null) {
		const relations = await db
			.select({ documentId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId })
			.from(schema.personsToOrganisationalUnits)
			.innerJoin(
				schema.documentLifecycle,
				eq(
					schema.documentLifecycle.documentId,
					schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`,
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.innerJoin(
				schema.personRoleTypes,
				eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
			)
			.where(
				and(
					eq(schema.personsToOrganisationalUnits.personDocumentId, user.personDocumentId),
					or(
						and(
							eq(schema.organisationalUnitTypes.type, "country"),
							inArray(schema.personRoleTypes.type, countryRoles),
						),
						and(
							eq(schema.organisationalUnitTypes.type, "working_group"),
							inArray(schema.personRoleTypes.type, workingGroupRoles),
						),
					),
					sql`${schema.personsToOrganisationalUnits.duration} @> NOW()::TIMESTAMPTZ`,
				),
			);
		for (const relation of relations) {
			documentIds.add(relation.documentId);
		}
	}

	if (documentIds.size === 0) {
		return { countries: [], workingGroups: [] };
	}

	const units = await db
		.select({
			documentId: schema.documentLifecycle.documentId,
			name: schema.organisationalUnits.name,
			slug: schema.slugs.value,
			type: schema.organisationalUnitTypes.type,
		})
		.from(schema.documentLifecycle)
		.innerJoin(schema.entities, eq(schema.entities.id, schema.documentLifecycle.documentId))
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`,
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(
			and(
				inArray(schema.documentLifecycle.documentId, [...documentIds]),
				inArray(schema.organisationalUnitTypes.type, ["country", "working_group"]),
			),
		)
		.orderBy(schema.organisationalUnits.name);

	const countryIds = units.filter((unit) => unit.type === "country").map((unit) => unit.documentId);
	const consortiumByCountryId = new Map<
		string,
		{ documentId: string; name: string; slug: string }
	>();
	if (countryIds.length > 0) {
		const consortiumLifecycle = schema.documentLifecycle;
		const consortiumEntities = schema.entities;
		const consortia = await db
			.select({
				countryDocumentId: schema.organisationalUnitsRelations.relatedUnitDocumentId,
				documentId: schema.organisationalUnitsRelations.unitDocumentId,
				name: schema.organisationalUnits.name,
				slug: schema.slugs.value,
			})
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
			)
			.innerJoin(
				consortiumLifecycle,
				eq(consortiumLifecycle.documentId, schema.organisationalUnitsRelations.unitDocumentId),
			)
			.innerJoin(consortiumEntities, eq(consortiumEntities.id, consortiumLifecycle.documentId))
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = COALESCE(${consortiumLifecycle.draftId}, ${consortiumLifecycle.publishedId})`,
			)
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
			.where(
				and(
					inArray(schema.organisationalUnitsRelations.relatedUnitDocumentId, countryIds),
					eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
					sql`${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ`,
				),
			);
		for (const consortium of consortia) {
			consortiumByCountryId.set(consortium.countryDocumentId, consortium);
		}
	}

	const countries = await Promise.all(
		units
			.filter((unit) => unit.type === "country")
			.map(async (unit) => {
				const consortium = consortiumByCountryId.get(unit.documentId) ?? null;
				return {
					...unit,
					canEdit:
						consortium != null &&
						(await can(user, "update", {
							type: "organisational_unit",
							id: consortium.documentId,
						})),
					nationalConsortium: consortium,
				};
			}),
	);
	const workingGroups = await Promise.all(
		units
			.filter((unit) => unit.type === "working_group")
			.map(async (unit) => {
				return {
					...unit,
					canEdit: await can(user, "update", {
						type: "organisational_unit",
						id: unit.documentId,
					}),
				};
			}),
	);

	return { countries, workingGroups };
}

export const getUserOrganisationalUnitScopes = cache(getUserOrganisationalUnitScopesUncached);
