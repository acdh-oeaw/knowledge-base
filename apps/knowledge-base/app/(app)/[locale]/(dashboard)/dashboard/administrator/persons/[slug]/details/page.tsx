import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { PersonDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_components/person-details";
import { discardPersonDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/discard-person-draft.action";
import { publishPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/publish-person.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getPersonContributions } from "@/lib/data/contributions";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorPersonDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/persons/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorPersonDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Person details"),
	});

	return metadata;
}

export default async function DashboardAdministratorPersonDetailsPage(
	props: Readonly<DashboardAdministratorPersonDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();
	await assertAuthenticated();

	const anyVersion = await db.query.persons.findFirst({
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

	const person = await db.query.persons.findFirst({
		where: { id: versionId },
		columns: {
			id: true,
			email: true,
			name: true,
			orcid: true,
			sortName: true,
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
					status: {
						columns: {
							id: true,
							type: true,
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

	if (person == null) {
		notFound();
	}

	assert(
		person.entityVersion.slug,
		`Slug missing for entity version "${person.entityVersion.id}".`,
	);
	const entityVersionSlug = person.entityVersion.slug;

	const [contributions, biographyContentBlocks, socialMediaLinks] = await Promise.all([
		getPersonContributions(documentId, displayLocaleId),
		getEntityContentBlocks(versionId, "biography"),
		db.query.personsToSocialMedia.findMany({
			where: { personId: person.id },
			columns: {},
			with: {
				socialMedia: {
					columns: { id: true, name: true, url: true },
					with: { type: { columns: { type: true } } },
				},
			},
		}),
	]);

	const image =
		person.image != null
			? {
					...person.image,
					url: images.generateSignedImageUrl({
						key: person.image.key,
						options: imageGridOptions,
					}).url,
				}
			: null;

	return (
		<PersonDetails
			contributions={contributions}
			discardDraftAction={discardPersonDraftAction}
			documentId={documentId}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			person={{
				...person,
				entityVersion: { ...person.entityVersion, slug: entityVersionSlug },
				biographyContentBlocks,
				image,
				socialMedia: socialMediaLinks.map((link) => link.socialMedia),
			}}
			publishAction={publishPersonAction}
			selectedVersion={selectedVersion}
		/>
	);
}
