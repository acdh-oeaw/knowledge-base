import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WorkingGroupEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_components/working-group-edit-form";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getContributionPersonOptions } from "@/lib/data/contributions";
import {
	ensureLocalizedDraftVersion,
	getDocumentLifecycleStateForLocale,
} from "@/lib/data/entity-lifecycle";
import { getLocales } from "@/lib/data/locales";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { getPersonRelationRoleOptions, getPersonRelations } from "@/lib/data/person-relations";
import {
	getEntityRelationOptions,
	getEntityRelationOptionsByIds,
	getEntityRelations,
	getResourceRelationOptions,
	getResourceRelationOptionsByIds,
} from "@/lib/data/relations";
import {
	selectedImageColumns,
	selectedImageWith,
	toSelectedImage,
} from "@/lib/data/selected-image";
import { getSocialMediaOptions, getSocialMediaOptionsByIds } from "@/lib/data/social-media";
import { getUnitRelationStatusOptions, getUnitRelations } from "@/lib/data/unit-relations";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditWorkingGroupPageProps extends PageProps<"/[locale]/dashboard/administrator/working-groups/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditWorkingGroupPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit working group"),
	});

	return metadata;
}

export default async function DashboardAdministratorEditWorkingGroupPage(
	props: Readonly<DashboardAdministratorEditWorkingGroupPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;
	await assertAuthenticated();

	const anyVersion = await db.query.organisationalUnits.findFirst({
		where: { entityVersion: { slug: { value: slug } } },
		columns: {},
		with: {
			entityVersion: {
				columns: {},
				with: { entity: { columns: { id: true } } },
			},
		},
	});

	if (anyVersion == null) {
		notFound();
	}

	const documentId = anyVersion.entityVersion.entity.id;

	const { locale: localeParam } = await searchParamsPromise;

	const locales = await getLocales();
	const requestedLocale = locales.find((locale) => locale.code === localeParam);
	const selectedLocale =
		requestedLocale ?? locales.find((locale) => locale.isDefault) ?? locales[0];

	if (selectedLocale == null) {
		notFound();
	}

	const { draftVersionId, hasDraftChanges, publishedId } = await db.transaction(async (tx) => {
		const { versionId: draftVersionId } = await ensureLocalizedDraftVersion(
			tx,
			documentId,
			organisationalUnitsLifecycleAdapter,
			selectedLocale.id,
		);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleStateForLocale(
			tx,
			documentId,
			selectedLocale.id,
		);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const [
		{ items: initialAssets },
		initialRelatedEntities,
		initialRelatedResources,
		initialPersons,
		initialSocialMedia,
		workingGroup,
	] = await Promise.all([
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "logos" }),
		getEntityRelationOptions(),
		getResourceRelationOptions(),
		getContributionPersonOptions(),
		getSocialMediaOptions(),
		db.query.organisationalUnits.findFirst({
			where: { id: draftVersionId },
			columns: {
				acronym: true,
				email: true,
				id: true,
				mailingList: true,
				name: true,
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
		}),
	]);

	if (workingGroup == null) {
		notFound();
	}

	assert(
		workingGroup.entityVersion.slug,
		`Slug missing for entity version "${workingGroup.entityVersion.id}".`,
	);
	const entityVersionSlug = workingGroup.entityVersion.slug;

	const [
		{ relatedEntityIds, relatedResourceIds },
		relations,
		personRelations,
		personRelationRoleOptions,
		descriptionContentBlocks,
		socialMediaRows,
	] = await Promise.all([
		getEntityRelations(documentId),
		getUnitRelations(documentId),
		getPersonRelations(documentId),
		getPersonRelationRoleOptions("working_group"),
		getEntityContentBlocks(workingGroup.id, "description"),
		db.query.organisationalUnitsToSocialMedia.findMany({
			where: { organisationalUnitId: workingGroup.id },
			orderBy: { position: "asc" },
			columns: { socialMediaId: true },
		}),
	]);

	const socialMediaIds = socialMediaRows.map((row) => row.socialMediaId);

	const unitRelationStatusOptions = await getUnitRelationStatusOptions("working_group");

	const [selectedRelatedEntities, selectedRelatedResources, selectedSocialMediaItems] =
		await Promise.all([
			getEntityRelationOptionsByIds(relatedEntityIds),
			getResourceRelationOptionsByIds(relatedResourceIds),
			getSocialMediaOptionsByIds(socialMediaIds),
		]);

	const image =
		workingGroup.image != null ? toSelectedImage(workingGroup.image, imageGridOptions) : null;

	return (
		<WorkingGroupEditForm
			documentId={documentId}
			hasDraftChanges={hasDraftChanges}
			initialAssets={initialAssets}
			initialPersonItems={initialPersons.items}
			initialPersonTotal={initialPersons.total}
			initialRelatedEntityIds={relatedEntityIds}
			initialRelatedEntityItems={initialRelatedEntities.items}
			initialRelatedEntityTotal={initialRelatedEntities.total}
			initialRelatedResourceIds={relatedResourceIds}
			initialRelatedResourceItems={initialRelatedResources.items}
			initialRelatedResourceTotal={initialRelatedResources.total}
			initialSocialMediaIds={socialMediaIds}
			initialSocialMediaItems={initialSocialMedia.items}
			initialSocialMediaTotal={initialSocialMedia.total}
			isDefaultLocale={selectedLocale.isDefault}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			personRelationRoleOptions={personRelationRoleOptions}
			personRelations={personRelations}
			relations={relations}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			selectedSocialMediaItems={selectedSocialMediaItems}
			unitRelationStatusOptions={unitRelationStatusOptions}
			workingGroup={{
				...workingGroup,
				entityVersion: { ...workingGroup.entityVersion, slug: entityVersionSlug },
				descriptionContentBlocks,
				image,
			}}
		/>
	);
}
