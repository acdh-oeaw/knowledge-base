import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { ProjectDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-details";
import { discardProjectDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/discard-project-draft.action";
import { publishProjectAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/publish-project.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getResolvedEntityContentBlocks } from "@/lib/content-blocks-service";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import { getProjectPartnerUnits } from "@/lib/data/project-partners";
import { getProjectAffiliatedPersons } from "@/lib/data/project-persons";
import {
	getEntityRelationOptionsByIds,
	getEntityRelations,
	getResourceRelationOptionsByIds,
} from "@/lib/data/relations";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorProjectDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/projects/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorProjectDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Project details"),
	});

	return metadata;
}

export default async function DashboardAdministratorProjectDetailsPage(
	props: Readonly<DashboardAdministratorProjectDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

	const t = await getExtracted();
	await assertAuthenticated();

	const anyVersion = await db.query.projects.findFirst({
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

	const project = await db.query.projects.findFirst({
		where: { id: versionId },
		columns: {
			acronym: true,
			duration: true,
			funding: true,
			id: true,
			name: true,
			summary: true,
			topic: true,
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
			scope: {
				columns: {
					id: true,
					scope: true,
				},
			},
			call: {
				columns: {
					id: true,
					call: true,
				},
			},
		},
	});

	if (project == null) {
		notFound();
	}

	assert(
		project.entityVersion.slug,
		`Slug missing for entity version "${project.entityVersion.id}".`,
	);
	const entityVersionSlug = project.entityVersion.slug;

	const [descriptionContentBlocks, partners, affiliatedPersons, socialMediaLinks] =
		await Promise.all([
			getResolvedEntityContentBlocks(versionId, "description"),
			getProjectPartnerUnits(documentId, displayLocaleId),
			getProjectAffiliatedPersons(documentId, displayLocaleId),
			db.query.projectsToSocialMedia.findMany({
				where: { projectId: project.id },
				orderBy: { position: "asc" },
				columns: {},
				with: {
					socialMedia: {
						columns: { id: true, name: true, url: true },
						with: { type: { columns: { type: true } } },
					},
				},
			}),
		]);

	const { relatedEntityIds, relatedResourceIds } = await getEntityRelations(documentId);

	const [selectedRelatedEntities, selectedRelatedResources] = await Promise.all([
		getEntityRelationOptionsByIds(relatedEntityIds),
		getResourceRelationOptionsByIds(relatedResourceIds),
	]);

	const image =
		project.image != null
			? {
					...project.image,
					url: images.generateSignedImageUrl({
						key: project.image.key,
						options: imageGridOptions,
					}).url,
				}
			: null;

	return (
		<ProjectDetails
			discardDraftAction={discardProjectDraftAction}
			documentId={documentId}
			hasDraft={hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			project={{
				...project,
				entityVersion: { ...project.entityVersion, slug: entityVersionSlug },
				descriptionContentBlocks,
				image,
				partners: partners.map((partner) => {
					return {
						id: partner.id,
						unitName: partner.unitName,
						unitSlug: partner.unitSlug,
						unitType: partner.unitType,
						roleName: partner.roleName,
						duration: partner.duration ?? null,
						unitIsLocaleFallback: partner.unitIsLocaleFallback,
					};
				}),
				affiliatedPersons: affiliatedPersons.map((person) => {
					return {
						id: person.id,
						personName: person.personName,
						personSlug: person.personSlug,
						duration: person.duration ?? null,
						personIsLocaleFallback: person.personIsLocaleFallback,
					};
				}),
				socialMedia: socialMediaLinks.map((link) => link.socialMedia),
			}}
			publishAction={publishProjectAction}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			selectedVersion={selectedVersion}
		/>
	);
}
