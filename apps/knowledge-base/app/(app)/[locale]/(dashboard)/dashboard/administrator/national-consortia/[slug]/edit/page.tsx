import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { NationalConsortiumEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/national-consortia/_components/national-consortium-edit-form";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getOrganisationalUnitEditDataForAdmin } from "@/lib/data/admin-organisational-units";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import {
	ensureLocalizedDraftVersion,
	getDocumentLifecycleStateForLocale,
} from "@/lib/data/entity-lifecycle";
import { getLocales } from "@/lib/data/locales";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { getEntityRelationOptions, getResourceRelationOptions } from "@/lib/data/relations";
import { toSelectedImage } from "@/lib/data/selected-image";
import { getSocialMediaOptions } from "@/lib/data/social-media";
import {
	getReverseUnitRelationStatusOptions,
	getReverseUnitRelations,
} from "@/lib/data/unit-relations";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditNationalConsortiumPageProps extends PageProps<"/[locale]/dashboard/administrator/national-consortia/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditNationalConsortiumPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit national consortium"),
	});

	return metadata;
}

export default async function DashboardAdministratorEditNationalConsortiumPage(
	props: Readonly<DashboardAdministratorEditNationalConsortiumPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;
	const { user } = await assertAuthenticated();

	const anyVersion = await db.query.organisationalUnits.findFirst({
		where: { entityVersion: { slug: { value: slug } }, type: { type: "national_consortium" } },
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
		initialSocialMedia,
		nationalConsortiumData,
		memberInstitutions,
		memberInstitutionStatusOptions,
	] = await Promise.all([
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "logos" }),
		getEntityRelationOptions(),
		getResourceRelationOptions(),
		getSocialMediaOptions(),
		getOrganisationalUnitEditDataForAdmin(user, {
			slug,
			unitType: "national_consortium",
			versionId: draftVersionId,
			publishedVersionId: publishedId,
		}),
		getReverseUnitRelations(documentId, { sourceUnitType: "institution" }),
		getReverseUnitRelationStatusOptions("national_consortium", "institution"),
	]);

	if (nationalConsortiumData == null) {
		notFound();
	}

	const {
		relations,
		relatedEntityIds,
		relatedResourceIds,
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedSocialMediaItems,
		socialMediaIds,
		unit: nationalConsortium,
		unitRelationStatusOptions,
	} = nationalConsortiumData;

	assert(
		nationalConsortium.entityVersion.slug,
		`Slug missing for entity version "${nationalConsortium.entityVersion.id}".`,
	);
	const entityVersionSlug = nationalConsortium.entityVersion.slug;

	const image =
		nationalConsortium.image != null
			? toSelectedImage(nationalConsortium.image, imageGridOptions)
			: null;

	return (
		<NationalConsortiumEditForm
			documentId={documentId}
			hasDraftChanges={hasDraftChanges}
			initialAssets={initialAssets}
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
			memberInstitutions={memberInstitutions}
			memberInstitutionStatusOptions={memberInstitutionStatusOptions}
			nationalConsortium={{
				...nationalConsortium,
				entityVersion: { ...nationalConsortium.entityVersion, slug: entityVersionSlug },
				image,
			}}
			relations={relations}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			selectedSocialMediaItems={selectedSocialMediaItems}
			unitRelationStatusOptions={unitRelationStatusOptions}
		/>
	);
}
