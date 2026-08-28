/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import type { User } from "@dariah-eric/auth";
import { forbidden } from "next/navigation";

import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import {
	getEntityRelationOptionsByIds,
	getEntityRelations,
	getResourceRelationOptionsByIds,
} from "@/lib/data/relations";
import { selectedImageColumns, selectedImageWith } from "@/lib/data/selected-image";
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

async function getOrganisationalUnitBySlug(
	unitType: ManagedOrganisationalUnitType,
	slug: string,
	versionId?: string,
) {
	return db.query.organisationalUnits.findFirst({
		where:
			versionId != null
				? { id: versionId, type: { type: unitType } }
				: {
						type: { type: unitType },
						entityVersion: { slug: { value: slug } },
					},
		columns: {
			acronym: true,
			email: true,
			id: true,
			mailingList: true,
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
						},
					},
					slug: {
						columns: {
							value: true,
						},
					},
				},
			},
			image: {
				columns: selectedImageColumns,
				with: selectedImageWith,
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
		/** Resolves related-unit names/slugs in this locale; defaults to the default locale. */
		localeId?: string;
	},
) {
	assertAdminUser(currentUser);
	return getOrganisationalUnitEditData(params);
}

/** Caller must perform its own page-level authorisation before using this data loader. */
export async function getOrganisationalUnitEditData(params: {
	slug: string;
	unitType: ManagedOrganisationalUnitType;
	versionId?: string;
	publishedVersionId?: string | null;
	/** Resolves related-unit names/slugs in this locale; defaults to the default locale. */
	localeId?: string;
}) {
	const { slug, unitType, versionId, localeId } = params;

	const unit = await getOrganisationalUnitBySlug(unitType, slug, versionId);

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
		getUnitRelations(documentId, localeId),
		db.query.organisationalUnitsToSocialMedia.findMany({
			where: { organisationalUnitId: unit.id },
			orderBy: { position: "asc" },
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
