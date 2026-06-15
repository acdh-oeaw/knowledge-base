/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import type { User } from "@acdh-knowledge-base/auth";
import { forbidden } from "next/navigation";

import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import {
	getEntityRelationOptionsByIds,
	getEntityRelations,
	getResourceRelationOptionsByIds,
} from "@/lib/data/relations";
import { getSocialMediaOptionsByIds } from "@/lib/data/social-media";
import { getUnitRelationStatusOptions, getUnitRelations } from "@/lib/data/unit-relations";
import { db } from "@/lib/db";

type ManagedOrganisationalUnitType =
	| "country"
	| "eric"
	| "governance_body"
	| "institution"
	| "national_consortium"
	| "working_group";

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

async function getOrganisationalUnitBySlugForAdmin(
	currentUser: Pick<User, "role">,
	unitType: ManagedOrganisationalUnitType,
	slug: string,
	versionId?: string,
) {
	assertAdminUser(currentUser);

	return db.query.organisationalUnits.findFirst({
		where:
			versionId != null
				? { id: versionId, type: { type: unitType } }
				: {
						type: { type: unitType },
						entityVersion: { entity: { slug } },
					},
		columns: {
			acronym: true,
			id: true,
			name: true,
			ror: true,
			sshocMarketplaceActorId: true,
			summary: true,
		},
		with: {
			entityVersion: {
				columns: { id: true },
				with: {
					entity: {
						columns: {
							id: true,
							slug: true,
						},
					},
				},
			},
			image: {
				columns: {
					key: true,
					label: true,
				},
			},
		},
	});
}

export async function getOrganisationalUnitEditDataForAdmin(
	currentUser: Pick<User, "role">,
	params: {
		slug: string;
		unitType: ManagedOrganisationalUnitType;
		versionId?: string;
		publishedVersionId?: string | null;
	},
) {
	const { slug, unitType, versionId } = params;

	const unit = await getOrganisationalUnitBySlugForAdmin(currentUser, unitType, slug, versionId);

	if (unit == null) {
		return null;
	}

	const documentId = unit.entityVersion.entity.id;
	const [
		descriptionContentBlocks,
		relationIds,
		relations,
		socialMediaRows,
		unitRelationStatusOptions,
	] = await Promise.all([
		getEntityContentBlocks(unit.id, "description"),
		getEntityRelations(documentId),
		getUnitRelations(documentId),
		db.query.organisationalUnitsToSocialMedia.findMany({
			where: { organisationalUnitId: unit.id },
			columns: { socialMediaId: true },
		}),
		getUnitRelationStatusOptions(unitType),
	]);

	const { relatedEntityIds, relatedResourceIds } = relationIds;
	const socialMediaIds = socialMediaRows.map((row) => row.socialMediaId);
	const [selectedRelatedEntities, selectedRelatedResources, selectedSocialMediaItems] =
		await Promise.all([
			getEntityRelationOptionsByIds(relatedEntityIds),
			getResourceRelationOptionsByIds(relatedResourceIds),
			getSocialMediaOptionsByIds(socialMediaIds),
		]);

	return {
		relations,
		relatedEntityIds,
		relatedResourceIds,
		selectedSocialMediaItems,
		socialMediaIds,
		selectedRelatedEntities,
		selectedRelatedResources,
		unit: {
			...unit,
			descriptionContentBlocks,
		},
		unitRelationStatusOptions,
	};
}
