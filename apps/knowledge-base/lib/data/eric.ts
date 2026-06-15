import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";
import { forbidden } from "next/navigation";

import {
	type EricReverseRelationSourceType,
	ericReverseRelationSourceTypes,
} from "@/lib/data/eric-relation-source-types";
import {
	type ReverseUnitRelation,
	type UnitRelationStatusOption,
	getReverseUnitRelationStatusOptions,
	getReverseUnitRelations,
} from "@/lib/data/unit-relations";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export interface EricReverseRelationGroup {
	relations: Array<ReverseUnitRelation>;
	statusOptions: Array<UnitRelationStatusOption>;
}

export type EricReverseRelationGroups = Record<
	EricReverseRelationSourceType,
	EricReverseRelationGroup
>;

export interface EricForAdmin {
	documentId: string;
	slug: string;
	name: string;
	hasDraft: boolean;
	isPublished: boolean;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

/** Resolve the singleton ERIC document and its lifecycle state for the admin list/landing. */
export async function getEricForAdmin(
	currentUser: Pick<User, "role">,
): Promise<EricForAdmin | null> {
	assertAdminUser(currentUser);

	const unit = await db.query.organisationalUnits.findFirst({
		where: { type: { type: "eric" } },
		columns: { name: true },
		with: {
			entityVersion: {
				columns: {},
				with: { entity: { columns: { id: true, slug: true } } },
			},
		},
	});

	if (unit == null) {
		return null;
	}

	const documentId = unit.entityVersion.entity.id;

	const lifecycle = await db
		.select({
			hasDraftChanges: schema.documentLifecycle.hasDraftChanges,
			publishedId: schema.documentLifecycle.publishedId,
		})
		.from(schema.documentLifecycle)
		.where(eq(schema.documentLifecycle.documentId, documentId))
		.then((rows) => rows[0] ?? null);

	return {
		documentId,
		slug: unit.entityVersion.entity.slug,
		name: unit.name,
		hasDraft: lifecycle?.hasDraftChanges ?? false,
		isPublished: lifecycle?.publishedId != null,
	};
}

/**
 * Fetch ERIC's reverse relations grouped by source unit type, each with the relation types allowed
 * into ERIC for that source. Shared by the edit (editable tabs) and details (read-only) views.
 */
export async function getEricReverseRelationGroups(
	documentId: string,
): Promise<EricReverseRelationGroups> {
	const entries = await Promise.all(
		ericReverseRelationSourceTypes.map(async (sourceUnitType) => {
			const [relations, statusOptions] = await Promise.all([
				getReverseUnitRelations(documentId, { sourceUnitType }),
				getReverseUnitRelationStatusOptions("eric", sourceUnitType),
			]);

			return [sourceUnitType, { relations, statusOptions }] as const;
		}),
	);

	return Object.fromEntries(entries) as EricReverseRelationGroups;
}
