import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DelegatedCountryEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_components/delegated-country-edit-form";
import { imageGridOptions } from "@/config/assets.config";
import { assertCan } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { getOrganisationalUnitEditData } from "@/lib/data/admin-organisational-units";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getContributionPersonOptions } from "@/lib/data/contributions";
import {
	ensureLocalizedDraftVersion,
	getDocumentLifecycleStateForLocale,
} from "@/lib/data/entity-lifecycle";
import { getLocales } from "@/lib/data/locales";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { getPersonRelationRoleOptions, getPersonRelations } from "@/lib/data/person-relations";
import { getSocialMediaOptions } from "@/lib/data/social-media";
import {
	getDariahEricDocumentId,
	getEricInstitutionsForCountry,
	getReverseUnitRelationStatusOptions,
} from "@/lib/data/unit-relations";
import { getUserOrganisationalUnitScopes } from "@/lib/data/user-organisational-units";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface CountryEditPageProps extends PageProps<"/[locale]/dashboard/countries/[code]/edit"> {}

export async function generateMetadata(
	_props: Readonly<CountryEditPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();
	return createMetadata(resolvingMetadata, { title: t("Edit national consortium") });
}

export default async function CountryEditPage(
	props: Readonly<CountryEditPageProps>,
): Promise<ReactNode> {
	const [{ code }, searchParams, { user }] = await Promise.all([
		props.params,
		props.searchParams,
		assertAuthenticated(),
	]);
	const scopes = await getUserOrganisationalUnitScopes(user);
	const country = scopes.countries.find((item) => item.slug === code);
	const consortium = country?.nationalConsortium;
	if (country == null || consortium == null || !country.canEdit) {
		notFound();
	}

	await assertCan(user, "update", { type: "organisational_unit", id: consortium.documentId });

	const locales = await getLocales();
	const requestedLocale = locales.find((locale) => locale.code === searchParams.locale);
	const selectedLocale =
		requestedLocale ?? locales.find((locale) => locale.isDefault) ?? locales[0];

	if (selectedLocale == null) {
		notFound();
	}

	const { draftVersionId, hasDraftChanges, publishedId } = await db.transaction(async (tx) => {
		const { versionId: draftVersionId } = await ensureLocalizedDraftVersion(
			tx,
			consortium.documentId,
			organisationalUnitsLifecycleAdapter,
			selectedLocale.id,
		);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleStateForLocale(
			tx,
			consortium.documentId,
			selectedLocale.id,
		);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	// People and partner institutions are attached to the country document (matching the admin model),
	// while the Details tab edits the national consortium. Relations are document-level and need no draft.
	const [
		{ items: initialAssets },
		initialSocialMedia,
		data,
		personRelations,
		personRelationRoleOptions,
		{ items: initialPersonItems, total: initialPersonTotal },
		ericDocumentId,
		ericInstitutions,
		ericInstitutionStatusOptions,
	] = await Promise.all([
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "logos" }),
		getSocialMediaOptions(),
		getOrganisationalUnitEditData({
			slug: consortium.slug,
			unitType: "national_consortium",
			versionId: draftVersionId,
			publishedVersionId: publishedId,
			localeId: selectedLocale.id,
		}),
		getPersonRelations(country.documentId),
		getPersonRelationRoleOptions("country"),
		getContributionPersonOptions({ includeDrafts: true }),
		getDariahEricDocumentId(),
		getEricInstitutionsForCountry(country.documentId, selectedLocale.id),
		getReverseUnitRelationStatusOptions("eric", "institution"),
	]);
	if (data == null) {
		notFound();
	}

	// The ERIC representation relations are stored as `institution -> ERIC` edges; surface them on the
	// country as the reverse-relation section's source units, scoped to this country.
	const ericInstitutionRelations = ericInstitutions.map((institution) => {
		return {
			id: institution.id,
			statusId: institution.statusId,
			statusType: institution.statusType,
			unitDocumentId: institution.institutionId,
			unitName: institution.institutionName,
			unitSlug: institution.institutionSlug,
			unitType: institution.institutionType,
			duration: institution.duration,
			description: institution.description,
			unitIsLocaleFallback: institution.institutionIsLocaleFallback,
		};
	});

	const image =
		data.unit.image == null
			? null
			: {
					...data.unit.image,
					url: images.generateSignedImageUrl({
						key: data.unit.image.key,
						options: imageGridOptions,
					}).url,
				};

	assert(
		data.unit.entityVersion.slug,
		`Slug missing for entity version "${data.unit.entityVersion.id}".`,
	);
	const entityVersionSlug = data.unit.entityVersion.slug;

	return (
		<DelegatedCountryEditForm
			countryDocumentId={country.documentId}
			documentId={consortium.documentId}
			ericDocumentId={ericDocumentId}
			ericInstitutionRelations={ericInstitutionRelations}
			ericInstitutionStatusOptions={ericInstitutionStatusOptions}
			hasDraftChanges={hasDraftChanges}
			initialAssets={initialAssets}
			initialPersonItems={initialPersonItems}
			initialPersonTotal={initialPersonTotal}
			initialSocialMediaIds={data.socialMediaIds}
			initialSocialMediaItems={initialSocialMedia.items}
			initialSocialMediaTotal={initialSocialMedia.total}
			isDefaultLocale={selectedLocale.isDefault}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			nationalConsortium={{
				...data.unit,
				entityVersion: { ...data.unit.entityVersion, slug: entityVersionSlug },
				image,
			}}
			personRelationRoleOptions={personRelationRoleOptions}
			personRelations={personRelations}
			selectedSocialMediaItems={data.selectedSocialMediaItems}
		/>
	);
}
