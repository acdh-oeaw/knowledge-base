import * as schema from "@dariah-eric/database/schema";

import { type Image, generateImageUrl, toImageAsset, withResolvedCaption } from "@/lib/images";
import { type PersonPosition, getPersonPositions } from "@/lib/persons";
import type { Database, Transaction } from "@/middlewares/db";
import { eq, inArray } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

export interface ProjectAffiliatedPerson {
	id: string;
	name: string;
	slug: string;
	image: Image | null;
	positions: Array<PersonPosition> | null;
	role: (typeof schema.projectRolesEnum)[number];
}

/**
 * Project↔person relations are document-level. Load a project document's affiliated people and
 * resolve each to their published version (name, slug, image, positions) — mirrors
 * `getContributors` on the article endpoints. Used by the public project endpoints, which only ever
 * expose published entities.
 */
export async function getPublishedProjectAffiliatedPersons(
	db: Database | Transaction,
	projectDocumentId: string,
): Promise<Array<ProjectAffiliatedPerson>> {
	const byDocument = await getPublishedProjectAffiliatedPersonsByDocuments(db, [projectDocumentId]);
	return byDocument.get(projectDocumentId) ?? [];
}

/** Batched variant of {@link getPublishedProjectAffiliatedPersons}, keyed by project document id. */
export async function getPublishedProjectAffiliatedPersonsByDocuments(
	db: Database | Transaction,
	projectDocumentIds: ReadonlyArray<string>,
): Promise<Map<string, Array<ProjectAffiliatedPerson>>> {
	const result = new Map<string, Array<ProjectAffiliatedPerson>>();
	if (projectDocumentIds.length === 0) {
		return result;
	}

	const rows = await db
		.select({
			projectDocumentId: schema.projectsToPersons.projectDocumentId,
			id: schema.persons.id,
			name: schema.persons.name,
			slug: schema.slugs.value,
			imageKey: schema.assets.key,
			imageWidth: schema.assets.width,
			imageHeight: schema.assets.height,
			imageAlt: schema.assets.alt,
			imageCaption: schema.assets.caption,
			personImageCaption: schema.persons.imageCaption,
			personImageCaptionMode: schema.persons.imageCaptionMode,
			licenseName: schema.licenses.name,
			licenseUrl: schema.licenses.url,
			role: schema.projectRoles.role,
		})
		.from(schema.projectsToPersons)
		.innerJoin(schema.projectRoles, eq(schema.projectRoles.id, schema.projectsToPersons.roleId))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.projectsToPersons.personDocumentId),
		)
		.innerJoin(schema.persons, eq(schema.persons.id, schema.documentLifecycle.publishedId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.documentLifecycle.publishedId))
		.leftJoin(schema.assets, eq(schema.persons.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.where(inArray(schema.projectsToPersons.projectDocumentId, [...projectDocumentIds]));

	const positions = await getPersonPositions(
		db,
		rows.map((row) => row.id),
	);

	for (const row of rows) {
		const {
			projectDocumentId,
			imageKey,
			imageAlt,
			imageCaption,
			imageWidth: imageSourceWidth,
			imageHeight: imageSourceHeight,
			personImageCaption,
			personImageCaptionMode,
			licenseName,
			licenseUrl,
			...rest
		} = row;

		const affiliatedPersons = result.get(projectDocumentId) ?? [];
		affiliatedPersons.push({
			...rest,
			positions: positions.get(row.id) ?? null,
			image: generateImageUrl(
				withResolvedCaption(
					toImageAsset({
						key: imageKey,
						alt: imageAlt,
						caption: imageCaption,
						width: imageSourceWidth,
						height: imageSourceHeight,
						licenseName,
						licenseUrl,
					}),
					{ imageCaption: personImageCaption, imageCaptionMode: personImageCaptionMode },
				),
				imageWidth.avatar,
			),
		});
		result.set(projectDocumentId, affiliatedPersons);
	}

	return result;
}
