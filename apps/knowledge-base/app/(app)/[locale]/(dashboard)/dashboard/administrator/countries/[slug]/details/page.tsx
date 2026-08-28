import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { CountryDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/countries/_components/country-details";
import { publishCountryAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/countries/_lib/publish-country.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { resolvePlaceholderValuesInContentBlocks } from "@/lib/content-blocks-service";
import { getOrganisationalUnitEditDataForAdmin } from "@/lib/data/admin-organisational-units";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import { getPersonRelations } from "@/lib/data/person-relations";
import { getEricInstitutionsForCountry, getReverseUnitRelations } from "@/lib/data/unit-relations";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/countries/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - View country"),
	});

	return metadata;
}

export default async function DashboardAdministratorCountryDetailsPage(
	props: Readonly<DashboardAdministratorCountryDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();
	const { user } = await assertAuthenticated();

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

	const { locale: localeParam, version } = await searchParamsPromise;

	const locales = await getLocales();
	const requestedLocale = locales.find((locale) => locale.code === localeParam);
	const selectedLocale =
		requestedLocale ?? locales.find((locale) => locale.isDefault) ?? locales[0];

	if (selectedLocale == null) {
		notFound();
	}

	const localizedVersion = await resolveLocalizedDetailVersion(
		documentId,
		version,
		locales,
		selectedLocale.id,
	);

	if (localizedVersion == null) {
		// The document exists (we already resolved `documentId` above) but has no version in the
		// selected locale, and no fallback to the default locale was possible either. Keep the
		// selector visible so the admin can switch to another locale rather than 404.
		return (
			<Fragment>
				<div className="flex items-center justify-between">
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocale.code} />
				</div>
				<p className="text-sm text-muted-fg italic">
					{t("This document has no content in the selected locale yet.")}
				</p>
			</Fragment>
		);
	}
	const {
		displayLocaleId,
		hasDraftChanges,
		isLocaleFallback,
		publishedId,
		selectedVersion,
		versionId,
	} = localizedVersion;

	const [personRelations, countryData, ericInstitutions, nationalConsortia] = await Promise.all([
		getPersonRelations(documentId),
		getOrganisationalUnitEditDataForAdmin(user, {
			slug,
			unitType: "country",
			versionId,
			publishedVersionId: publishedId,
			localeId: displayLocaleId,
		}),
		getEricInstitutionsForCountry(documentId, displayLocaleId),
		getReverseUnitRelations(documentId, {
			sourceUnitType: "national_consortium",
			localeId: displayLocaleId,
		}),
	]);

	if (countryData == null) {
		notFound();
	}

	const {
		relations,
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedSocialMediaItems,
		unit: country,
	} = countryData;

	assert(
		country.entityVersion.slug,
		`Slug missing for entity version "${country.entityVersion.id}".`,
	);
	const entityVersionSlug = country.entityVersion.slug;
	const descriptionContentBlocks = await resolvePlaceholderValuesInContentBlocks(
		country.descriptionContentBlocks,
	);

	const image =
		country.image != null
			? {
					...country.image,
					url: images.generateSignedImageUrl({
						key: country.image.key,
						options: imageGridOptions,
					}).url,
				}
			: null;

	return (
		<CountryDetails
			country={{
				...country,
				entityVersion: { ...country.entityVersion, slug: entityVersionSlug },
				descriptionContentBlocks,
				image,
			}}
			documentId={documentId}
			ericInstitutions={ericInstitutions}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			nationalConsortia={nationalConsortia}
			selectedLocaleCode={selectedLocale.code}
			personRelations={personRelations}
			relations={relations}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			selectedSocialMediaItems={selectedSocialMediaItems}
			publishAction={publishCountryAction}
			selectedVersion={selectedVersion}
		/>
	);
}
