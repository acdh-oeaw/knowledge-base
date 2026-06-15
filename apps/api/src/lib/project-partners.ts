import * as schema from "@acdh-knowledge-base/database/schema";

import type { Database, Transaction } from "@/middlewares/db";
import { eq, inArray } from "@/services/db/sql";

export interface ProjectPartner {
	unit: {
		id: string;
		acronym: string | null;
		name: string;
		slug: string;
		type: (typeof schema.organisationalUnitTypesEnum)[number];
		socialMedia: Array<{ url: string; type: (typeof schema.socialMediaTypesEnum)[number] }>;
	};
	role: { id: string; role: (typeof schema.projectRolesEnum)[number] };
}

/**
 * Project↔org relations are document-level. Load a project document's partners and resolve each
 * partner organisation to its _published_ version (name, type, social media). Used by the public
 * project endpoints, which only ever expose published entities.
 */
export async function getPublishedProjectPartners(
	db: Database | Transaction,
	projectDocumentId: string,
): Promise<Array<ProjectPartner>> {
	const byDocument = await getPublishedProjectPartnersByDocuments(db, [projectDocumentId]);
	return byDocument.get(projectDocumentId) ?? [];
}

/** Batched variant of {@link getPublishedProjectPartners}, keyed by project document id. */
export async function getPublishedProjectPartnersByDocuments(
	db: Database | Transaction,
	projectDocumentIds: ReadonlyArray<string>,
): Promise<Map<string, Array<ProjectPartner>>> {
	const result = new Map<string, Array<ProjectPartner>>();
	if (projectDocumentIds.length === 0) {
		return result;
	}

	const partnerRows = await db
		.select({
			projectDocumentId: schema.projectsToOrganisationalUnits.projectDocumentId,
			unitVersionId: schema.organisationalUnits.id,
			acronym: schema.organisationalUnits.acronym,
			name: schema.organisationalUnits.name,
			slug: schema.entities.slug,
			unitType: schema.organisationalUnitTypes.type,
			roleId: schema.projectRoles.id,
			roleName: schema.projectRoles.role,
		})
		.from(schema.projectsToOrganisationalUnits)
		.innerJoin(
			schema.projectRoles,
			eq(schema.projectRoles.id, schema.projectsToOrganisationalUnits.roleId),
		)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.projectsToOrganisationalUnits.unitDocumentId),
		)
		.innerJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, schema.documentLifecycle.publishedId),
		)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.organisationalUnits.id))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(
			inArray(schema.projectsToOrganisationalUnits.projectDocumentId, [...projectDocumentIds]),
		);

	const unitVersionIds = [...new Set(partnerRows.map((row) => row.unitVersionId))];

	const socialMediaRows =
		unitVersionIds.length > 0
			? await db
					.select({
						unitVersionId: schema.organisationalUnitsToSocialMedia.organisationalUnitId,
						url: schema.socialMedia.url,
						type: schema.socialMediaTypes.type,
					})
					.from(schema.organisationalUnitsToSocialMedia)
					.innerJoin(
						schema.socialMedia,
						eq(schema.socialMedia.id, schema.organisationalUnitsToSocialMedia.socialMediaId),
					)
					.innerJoin(
						schema.socialMediaTypes,
						eq(schema.socialMediaTypes.id, schema.socialMedia.typeId),
					)
					.where(
						inArray(schema.organisationalUnitsToSocialMedia.organisationalUnitId, unitVersionIds),
					)
			: [];

	const socialMediaByUnit = new Map<
		string,
		Array<{ url: string; type: (typeof schema.socialMediaTypesEnum)[number] }>
	>();
	for (const row of socialMediaRows) {
		const items = socialMediaByUnit.get(row.unitVersionId) ?? [];
		items.push({ url: row.url, type: row.type });
		socialMediaByUnit.set(row.unitVersionId, items);
	}

	for (const row of partnerRows) {
		const partners = result.get(row.projectDocumentId) ?? [];
		partners.push({
			unit: {
				id: row.unitVersionId,
				acronym: row.acronym,
				name: row.name,
				slug: row.slug,
				type: row.unitType,
				socialMedia: socialMediaByUnit.get(row.unitVersionId) ?? [],
			},
			role: { id: row.roleId, role: row.roleName },
		});
		result.set(row.projectDocumentId, partners);
	}

	return result;
}
