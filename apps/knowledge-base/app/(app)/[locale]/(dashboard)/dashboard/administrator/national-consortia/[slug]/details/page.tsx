import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { NationalConsortiumDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/national-consortia/_components/national-consortia-details";
import { publishNationalConsortiumAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/national-consortia/_lib/publish-national-consortium.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { resolvePlaceholderValuesInContentBlocks } from "@/lib/content-blocks-service";
import { getOrganisationalUnitEditDataForAdmin } from "@/lib/data/admin-organisational-units";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorNationalConsortiumDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/national-consortia/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorNationalConsortiumDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - View national consortium"),
	});

	return metadata;
}

export default async function DashboardAdministratorNationalConsortiumDetailsPage(
	props: Readonly<DashboardAdministratorNationalConsortiumDetailsPageProps>,
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

	const nationalConsortiumData = await getOrganisationalUnitEditDataForAdmin(user, {
		slug,
		unitType: "national_consortium",
		versionId,
		publishedVersionId: publishedId,
		localeId: displayLocaleId,
	});

	if (nationalConsortiumData == null) {
		notFound();
	}

	const {
		relations,
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedSocialMediaItems,
		unit: nationalConsortium,
	} = nationalConsortiumData;

	assert(
		nationalConsortium.entityVersion.slug,
		`Slug missing for entity version "${nationalConsortium.entityVersion.id}".`,
	);
	const entityVersionSlug = nationalConsortium.entityVersion.slug;
	const descriptionContentBlocks = await resolvePlaceholderValuesInContentBlocks(
		nationalConsortium.descriptionContentBlocks,
	);

	const image =
		nationalConsortium.image != null
			? {
					...nationalConsortium.image,
					url: images.generateSignedImageUrl({
						key: nationalConsortium.image.key,
						options: imageGridOptions,
					}).url,
				}
			: null;

	return (
		<NationalConsortiumDetails
			documentId={documentId}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			nationalConsortium={{
				...nationalConsortium,
				entityVersion: { ...nationalConsortium.entityVersion, slug: entityVersionSlug },
				descriptionContentBlocks,
				image,
			}}
			relations={relations}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			selectedSocialMediaItems={selectedSocialMediaItems}
			publishAction={publishNationalConsortiumAction}
			selectedVersion={selectedVersion}
		/>
	);
}
