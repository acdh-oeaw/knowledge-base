import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PersonEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_components/person-edit-form";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getContributionRoleOptions, getPersonContributions } from "@/lib/data/contributions";
import {
	ensureLocalizedDraftVersion,
	getDocumentLifecycleStateForLocale,
} from "@/lib/data/entity-lifecycle";
import { getLocales } from "@/lib/data/locales";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import { getSocialMediaOptions, getSocialMediaOptionsByIds } from "@/lib/data/social-media";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditPersonPageProps extends PageProps<"/[locale]/dashboard/administrator/persons/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditPersonPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit person"),
	});

	return metadata;
}

export default async function DashboardAdministratorEditPersonPage(
	props: Readonly<DashboardAdministratorEditPersonPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

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
			personsLifecycleAdapter,
			selectedLocale.id,
		);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleStateForLocale(
			tx,
			documentId,
			selectedLocale.id,
		);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const [{ items: initialAssets }, person] = await Promise.all([
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "avatars" }),
		db.query.persons.findFirst({
			where: { id: draftVersionId },
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
		}),
	]);

	if (person == null) {
		notFound();
	}

	assert(
		person.entityVersion.slug,
		`Slug missing for entity version "${person.entityVersion.id}".`,
	);
	const entityVersionSlug = person.entityVersion.slug;

	const [
		contributions,
		contributionRoleOptions,
		biographyContentBlocks,
		initialSocialMedia,
		existingSocialMedia,
	] = await Promise.all([
		getPersonContributions(documentId),
		getContributionRoleOptions(),
		getEntityContentBlocks(person.id, "biography"),
		getSocialMediaOptions(),
		db.query.personsToSocialMedia.findMany({
			where: { personId: person.id },
			columns: { socialMediaId: true },
		}),
	]);

	const initialSocialMediaIds = existingSocialMedia.map((row) => row.socialMediaId);

	const selectedSocialMediaItems = await getSocialMediaOptionsByIds(initialSocialMediaIds);

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
		<PersonEditForm
			contributionRoleOptions={contributionRoleOptions}
			contributions={contributions}
			documentId={documentId}
			hasDraftChanges={hasDraftChanges}
			initialAssets={initialAssets}
			initialSocialMediaIds={initialSocialMediaIds}
			initialSocialMediaItems={initialSocialMedia.items}
			initialSocialMediaTotal={initialSocialMedia.total}
			isDefaultLocale={selectedLocale.isDefault}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			person={{
				...person,
				entityVersion: { ...person.entityVersion, slug: entityVersionSlug },
				biographyContentBlocks,
				image,
			}}
			selectedSocialMediaItems={selectedSocialMediaItems}
		/>
	);
}
