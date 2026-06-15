import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CountryDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/countries/_components/country-details";
import { publishCountryAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/countries/_lib/publish-country.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getOrganisationalUnitEditDataForAdmin } from "@/lib/data/admin-organisational-units";
import { resolveSelectedDetailVersion } from "@/lib/data/entity-detail-view";
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

	const { user } = await assertAuthenticated();

	const anyVersion = await db.query.organisationalUnits.findFirst({
		where: { entityVersion: { entity: { slug } } },
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

	const { version } = await searchParamsPromise;

	const versionState = await resolveSelectedDetailVersion(documentId, version);
	if (versionState == null) {
		notFound();
	}
	const { hasDraftChanges, publishedId, selectedVersion, versionId } = versionState;

	const [personRelations, countryData, ericInstitutions, nationalConsortia] = await Promise.all([
		getPersonRelations(documentId),
		getOrganisationalUnitEditDataForAdmin(user, {
			slug,
			unitType: "country",
			versionId,
			publishedVersionId: publishedId,
		}),
		getEricInstitutionsForCountry(documentId),
		getReverseUnitRelations(documentId, { sourceUnitType: "national_consortium" }),
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
			country={{ ...country, image }}
			documentId={documentId}
			ericInstitutions={ericInstitutions}
			hasDraft={hasDraftChanges}
			isPublished={publishedId != null}
			nationalConsortia={nationalConsortia}
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
