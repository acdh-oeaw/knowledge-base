import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { alias, and, count, desc, eq, or, sql } from "@/lib/db/sql";

export type InstitutionRelationsSort =
	| "institutionName"
	| "statusType"
	| "relatedUnitName"
	| "relatedUnitType"
	| "durationStart"
	| "durationEnd";

interface GetInstitutionRelationsParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: InstitutionRelationsSort;
	dir?: "asc" | "desc";
}

export interface InstitutionRelationsResult {
	data: Array<{
		id: string;
		institutionDocumentId: string;
		institutionName: string;
		institutionSlug: string;
		statusId: string;
		statusType: string;
		relatedUnitDocumentId: string;
		relatedUnitName: string;
		relatedUnitType: string;
		durationStart: Date;
		durationEnd: Date | undefined;
	}>;
	limit: number;
	offset: number;
	total: number;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

export async function getInstitutionRelations(
	params: Readonly<GetInstitutionRelationsParams>,
): Promise<InstitutionRelationsResult> {
	const { limit, offset, q, sort = "institutionName", dir = "asc" } = params;
	const relatedOrganisationalUnits = alias(
		schema.organisationalUnits,
		"related_organisational_units",
	);
	const relatedOrganisationalUnitTypes = alias(
		schema.organisationalUnitTypes,
		"related_organisational_unit_types",
	);
	const baseWhere = eq(
		schema.organisationalUnitTypes.type,
		"institution" as typeof schema.organisationalUnitTypes.$inferSelect.type,
	);
	// Unit↔unit relations are document-level; resolve both endpoints to their latest editable version.
	const institutionEntities = alias(schema.entities, "institution_entities");
	const institutionDocumentLifecycle = alias(
		schema.documentLifecycle,
		"institution_document_lifecycle",
	);
	const relatedDocumentLifecycle = alias(schema.documentLifecycle, "related_document_lifecycle");
	const institutionPickedVersion = sql`COALESCE(${institutionDocumentLifecycle.draftId}, ${institutionDocumentLifecycle.publishedId})`;
	const relatedPickedVersion = sql`COALESCE(${relatedDocumentLifecycle.draftId}, ${relatedDocumentLifecycle.publishedId})`;
	const query = q?.trim();
	const where =
		query != null && query !== ""
			? and(
					baseWhere,
					or(
						unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
						unaccentIlike(schema.organisationalUnitStatus.status, `%${query}%`),
						unaccentIlike(relatedOrganisationalUnits.name, `%${query}%`),
						unaccentIlike(relatedOrganisationalUnitTypes.type, `%${query}%`),
					),
				)
			: undefined;
	const orderBy =
		sort === "statusType"
			? dir === "asc"
				? schema.organisationalUnitStatus.status
				: desc(schema.organisationalUnitStatus.status)
			: sort === "relatedUnitName"
				? dir === "asc"
					? relatedOrganisationalUnits.name
					: desc(relatedOrganisationalUnits.name)
				: sort === "relatedUnitType"
					? dir === "asc"
						? relatedOrganisationalUnitTypes.type
						: desc(relatedOrganisationalUnitTypes.type)
					: sort === "durationStart"
						? dir === "asc"
							? sql`LOWER(${schema.organisationalUnitsRelations.duration}) ASC`
							: sql`LOWER(${schema.organisationalUnitsRelations.duration}) DESC`
						: sort === "durationEnd"
							? dir === "asc"
								? sql`UPPER(${schema.organisationalUnitsRelations.duration}) ASC NULLS LAST`
								: sql`UPPER(${schema.organisationalUnitsRelations.duration}) DESC NULLS LAST`
							: dir === "asc"
								? schema.organisationalUnits.name
								: desc(schema.organisationalUnits.name);

	const [rows, aggregate] = await Promise.all([
		db
			.select({
				id: schema.organisationalUnitsRelations.id,
				institutionDocumentId: schema.organisationalUnitsRelations.unitDocumentId,
				institutionName: schema.organisationalUnits.name,
				institutionSlug: institutionEntities.slug,
				statusId: schema.organisationalUnitsRelations.status,
				statusType: schema.organisationalUnitStatus.status,
				relatedUnitDocumentId: schema.organisationalUnitsRelations.relatedUnitDocumentId,
				relatedUnitName: relatedOrganisationalUnits.name,
				relatedUnitType: relatedOrganisationalUnitTypes.type,
				duration: schema.organisationalUnitsRelations.duration,
			})
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				institutionEntities,
				eq(institutionEntities.id, schema.organisationalUnitsRelations.unitDocumentId),
			)
			.innerJoin(
				institutionDocumentLifecycle,
				eq(institutionDocumentLifecycle.documentId, institutionEntities.id),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = ${institutionPickedVersion}`,
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
			)
			.innerJoin(
				relatedDocumentLifecycle,
				eq(
					relatedDocumentLifecycle.documentId,
					schema.organisationalUnitsRelations.relatedUnitDocumentId,
				),
			)
			.innerJoin(
				relatedOrganisationalUnits,
				sql`${relatedOrganisationalUnits.id} = ${relatedPickedVersion}`,
			)
			.innerJoin(
				relatedOrganisationalUnitTypes,
				eq(relatedOrganisationalUnitTypes.id, relatedOrganisationalUnits.typeId),
			)
			.where(where ?? baseWhere)
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				institutionDocumentLifecycle,
				eq(
					institutionDocumentLifecycle.documentId,
					schema.organisationalUnitsRelations.unitDocumentId,
				),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = ${institutionPickedVersion}`,
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
			)
			.innerJoin(
				relatedDocumentLifecycle,
				eq(
					relatedDocumentLifecycle.documentId,
					schema.organisationalUnitsRelations.relatedUnitDocumentId,
				),
			)
			.innerJoin(
				relatedOrganisationalUnits,
				sql`${relatedOrganisationalUnits.id} = ${relatedPickedVersion}`,
			)
			.innerJoin(
				relatedOrganisationalUnitTypes,
				eq(relatedOrganisationalUnitTypes.id, relatedOrganisationalUnits.typeId),
			)
			.where(where ?? baseWhere),
	]);

	return {
		data: rows.map((row) => {
			return {
				id: row.id,
				institutionDocumentId: row.institutionDocumentId,
				institutionName: row.institutionName,
				institutionSlug: row.institutionSlug,
				statusId: row.statusId,
				statusType: row.statusType,
				relatedUnitDocumentId: row.relatedUnitDocumentId,
				relatedUnitName: row.relatedUnitName,
				relatedUnitType: row.relatedUnitType,
				durationStart: row.duration.start,
				durationEnd: row.duration.end,
			};
		}),
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getInstitutionRelationsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetInstitutionRelationsParams>,
): Promise<InstitutionRelationsResult> {
	assertAdminUser(currentUser);

	return getInstitutionRelations(params);
}
