import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { InstitutionDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/institutions/_components/institution-details";
import { publishInstitutionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/institutions/_lib/publish-institution.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getResolvedEntityContentBlocks } from "@/lib/content-blocks-service";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import { getPersonRelations } from "@/lib/data/person-relations";
import { getUnitProjectPartnerships } from "@/lib/data/project-partners";
import {
	getEntityRelationOptionsByIds,
	getEntityRelations,
	getResourceRelationOptionsByIds,
} from "@/lib/data/relations";
import { getSocialMediaOptionsByIds } from "@/lib/data/social-media";
import { getUnitRelations } from "@/lib/data/unit-relations";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorInstitutionDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/institutions/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorInstitutionDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - View institution"),
	});

	return metadata;
}

export default async function DashboardAdministratorInstitutionDetailsPage(
	props: Readonly<DashboardAdministratorInstitutionDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();
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

	const institution = await db.query.organisationalUnits.findFirst({
		where: { id: versionId },
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
				columns: {
					key: true,
					label: true,
				},
			},
		},
	});

	if (institution == null) {
		notFound();
	}

	const [
		personRelations,
		{ relatedEntityIds, relatedResourceIds },
		relations,
		projectPartnerships,
		socialMediaRows,
		descriptionContentBlocks,
	] = await Promise.all([
		getPersonRelations(documentId),
		getEntityRelations(documentId),
		getUnitRelations(documentId, displayLocaleId),
		getUnitProjectPartnerships(documentId, displayLocaleId),
		db.query.organisationalUnitsToSocialMedia.findMany({
			where: { organisationalUnitId: institution.id },
			orderBy: { position: "asc" },
			columns: { socialMediaId: true },
		}),
		getResolvedEntityContentBlocks(versionId, "description"),
	]);

	const socialMediaIds = socialMediaRows.map((row) => row.socialMediaId);

	const [selectedRelatedEntities, selectedRelatedResources, selectedSocialMediaItems] =
		await Promise.all([
			getEntityRelationOptionsByIds(relatedEntityIds),
			getResourceRelationOptionsByIds(relatedResourceIds),
			getSocialMediaOptionsByIds(socialMediaIds),
		]);

	assert(
		institution.entityVersion.slug,
		`Slug missing for entity version "${institution.entityVersion.id}".`,
	);
	const entityVersionSlug = institution.entityVersion.slug;

	const image =
		institution.image != null
			? {
					...institution.image,
					url: images.generateSignedImageUrl({
						key: institution.image.key,
						options: imageGridOptions,
					}).url,
				}
			: null;

	return (
		<InstitutionDetails
			documentId={documentId}
			institution={{
				...institution,
				entityVersion: { ...institution.entityVersion, slug: entityVersionSlug },
				descriptionContentBlocks,
				image,
			}}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			personRelations={personRelations}
			projectPartnerships={projectPartnerships}
			relations={relations}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			selectedSocialMediaItems={selectedSocialMediaItems}
			publishAction={publishInstitutionAction}
			selectedVersion={selectedVersion}
		/>
	);
}
