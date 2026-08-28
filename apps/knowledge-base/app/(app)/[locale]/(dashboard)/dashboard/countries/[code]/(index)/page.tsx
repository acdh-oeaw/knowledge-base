import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { NationalConsortiumDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/national-consortia/_components/national-consortia-details";
import { imageGridOptions } from "@/config/assets.config";
import { assertCan } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { getOrganisationalUnitEditData } from "@/lib/data/admin-organisational-units";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import { getUserOrganisationalUnitScopes } from "@/lib/data/user-organisational-units";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface CountryPageProps extends PageProps<"/[locale]/dashboard/countries/[code]"> {}

export async function generateMetadata(
	_props: Readonly<CountryPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();
	return createMetadata(resolvingMetadata, { title: t("National consortium") });
}

export default async function CountryPage(props: Readonly<CountryPageProps>): Promise<ReactNode> {
	const [{ code }, searchParams, { user }] = await Promise.all([
		props.params,
		props.searchParams,
		assertAuthenticated(),
	]);
	const t = await getExtracted();
	const scopes = await getUserOrganisationalUnitScopes(user);
	const country = scopes.countries.find((item) => item.slug === code);
	const consortium = country?.nationalConsortium;
	if (country == null || consortium == null) {
		notFound();
	}

	await assertCan(user, "read", { type: "organisational_unit", id: consortium.documentId });
	const requestedVersion = country.canEdit ? searchParams.version : "published";

	const locales = await getLocales();
	const requestedLocale = locales.find((locale) => locale.code === searchParams.locale);
	const selectedLocale =
		requestedLocale ?? locales.find((locale) => locale.isDefault) ?? locales[0];

	if (selectedLocale == null) {
		notFound();
	}

	const localizedVersion = await resolveLocalizedDetailVersion(
		consortium.documentId,
		requestedVersion,
		locales,
		selectedLocale.id,
	);

	if (localizedVersion == null) {
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

	if (!country.canEdit && localizedVersion.publishedId == null) {
		notFound();
	}

	const {
		displayLocaleId,
		hasDraftChanges,
		isLocaleFallback,
		publishedId,
		selectedVersion,
		versionId,
	} = localizedVersion;

	const data = await getOrganisationalUnitEditData({
		slug: consortium.slug,
		unitType: "national_consortium",
		versionId,
		publishedVersionId: publishedId,
		localeId: displayLocaleId,
	});
	if (data == null) {
		notFound();
	}

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
	const detailHref = `/dashboard/countries/${country.slug}`;

	assert(
		data.unit.entityVersion.slug,
		`Slug missing for entity version "${data.unit.entityVersion.id}".`,
	);
	const entityVersionSlug = data.unit.entityVersion.slug;

	return (
		<NationalConsortiumDetails
			detailHref={detailHref}
			documentId={consortium.documentId}
			editHref={country.canEdit ? `${detailHref}/edit` : null}
			enableAdminEntityLinks={false}
			hasDraft={country.canEdit && hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			nationalConsortium={{
				...data.unit,
				entityVersion: { ...data.unit.entityVersion, slug: entityVersionSlug },
				image,
			}}
			relations={data.relations}
			selectedLocaleCode={selectedLocale.code}
			selectedRelatedEntities={data.selectedRelatedEntities}
			selectedRelatedResources={data.selectedRelatedResources}
			selectedSocialMediaItems={data.selectedSocialMediaItems}
			selectedVersion={selectedVersion}
		/>
	);
}
