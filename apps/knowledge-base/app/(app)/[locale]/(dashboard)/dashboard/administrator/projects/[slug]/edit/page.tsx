import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProjectEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-edit-form";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import {
	ensureLocalizedDraftVersion,
	getDocumentLifecycleStateForLocale,
} from "@/lib/data/entity-lifecycle";
import { getLocales } from "@/lib/data/locales";
import { projectsLifecycleAdapter } from "@/lib/data/projects.lifecycle-adapter";
import {
	getEntityRelationOptions,
	getEntityRelationOptionsByIds,
	getEntityRelations,
	getResourceRelationOptions,
	getResourceRelationOptionsByIds,
} from "@/lib/data/relations";
import {
	selectedImageColumns,
	selectedImageWith,
	toSelectedImage,
} from "@/lib/data/selected-image";
import { getSocialMediaOptions, getSocialMediaOptionsByIds } from "@/lib/data/social-media";
import { db } from "@/lib/db";
import { alias, eq } from "@/lib/db/sql";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditProjectPageProps extends PageProps<"/[locale]/dashboard/administrator/projects/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditProjectPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit project"),
	});

	return metadata;
}

export default async function DashboardAdministratorEditProjectPage(
	props: Readonly<DashboardAdministratorEditProjectPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;

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
			projectsLifecycleAdapter,
			selectedLocale.id,
		);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleStateForLocale(
			tx,
			documentId,
			selectedLocale.id,
		);
		return { draftVersionId, hasDraftChanges, publishedId };
	});

	const [{ items: initialAssets }, project] = await Promise.all([
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "logos" }),
		db.query.projects.findFirst({
			where: { id: draftVersionId },
			columns: {
				acronym: true,
				call: true,
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
					columns: selectedImageColumns,
					with: selectedImageWith,
				},
				scope: {
					columns: {
						id: true,
						scope: true,
					},
				},
			},
		}),
	]);

	if (project == null) {
		notFound();
	}

	assert(
		project.entityVersion.slug,
		`Slug missing for entity version "${project.entityVersion.id}".`,
	);
	const entityVersionSlug = project.entityVersion.slug;

	const [
		descriptionContentBlocks,
		scopes,
		roles,
		initialSocialMedia,
		existingPartners,
		existingSocialMedia,
		initialRelatedEntities,
		initialRelatedResources,
		relations,
	] = await Promise.all([
		getEntityContentBlocks(project.id, "description"),
		db.query.projectScopes.findMany({
			orderBy: { scope: "asc" },
			columns: { id: true, scope: true },
		}),
		db.query.projectRoles.findMany({
			orderBy: { role: "asc" },
			columns: { id: true, role: true },
		}),
		getSocialMediaOptions(),
		(() => {
			const unitDocumentLifecycle = alias(schema.documentLifecycle, "unit_document_lifecycle");
			return db
				.select({
					id: schema.projectsToOrganisationalUnits.id,
					unitDocumentId: schema.projectsToOrganisationalUnits.unitDocumentId,
					unitName: schema.organisationalUnits.name,
					roleId: schema.projectsToOrganisationalUnits.roleId,
					roleName: schema.projectRoles.role,
					duration: schema.projectsToOrganisationalUnits.duration,
				})
				.from(schema.projectsToOrganisationalUnits)
				.innerJoin(
					unitDocumentLifecycle,
					eq(unitDocumentLifecycle.documentId, schema.projectsToOrganisationalUnits.unitDocumentId),
				)
				.innerJoin(
					schema.organisationalUnits,
					eq(schema.organisationalUnits.id, unitDocumentLifecycle.publishedId),
				)
				.innerJoin(
					schema.projectRoles,
					eq(schema.projectRoles.id, schema.projectsToOrganisationalUnits.roleId),
				)
				.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, documentId));
		})(),
		db.query.projectsToSocialMedia.findMany({
			where: { projectId: project.id },
			orderBy: { position: "asc" },
			columns: { socialMediaId: true },
		}),
		getEntityRelationOptions(),
		getResourceRelationOptions(),
		getEntityRelations(documentId),
	]);

	const [selectedRelatedEntities, selectedRelatedResources] = await Promise.all([
		getEntityRelationOptionsByIds(relations.relatedEntityIds),
		getResourceRelationOptionsByIds(relations.relatedResourceIds),
	]);

	const initialPartners = existingPartners.map((partner) => {
		return {
			id: partner.id,
			unitDocumentId: partner.unitDocumentId,
			unitName: partner.unitName,
			roleId: partner.roleId,
			roleName: partner.roleName,
			durationStart: partner.duration?.start ?? null,
			durationEnd: partner.duration?.end ?? null,
		};
	});

	const initialSocialMediaIds = existingSocialMedia.map((row) => row.socialMediaId);

	const selectedSocialMediaItems = await getSocialMediaOptionsByIds(initialSocialMediaIds);

	const image = project.image != null ? toSelectedImage(project.image, imageGridOptions) : null;

	return (
		<ProjectEditForm
			documentId={documentId}
			hasDraftChanges={hasDraftChanges}
			initialAssets={initialAssets}
			initialPartners={initialPartners}
			isDefaultLocale={selectedLocale.isDefault}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			project={{
				...project,
				entityVersion: { ...project.entityVersion, slug: entityVersionSlug },
				descriptionContentBlocks,
				image,
			}}
			initialRelatedEntityIds={relations.relatedEntityIds}
			initialRelatedEntityItems={initialRelatedEntities.items}
			initialRelatedEntityTotal={initialRelatedEntities.total}
			initialRelatedResourceIds={relations.relatedResourceIds}
			initialRelatedResourceItems={initialRelatedResources.items}
			initialRelatedResourceTotal={initialRelatedResources.total}
			initialSocialMediaIds={initialSocialMediaIds}
			initialSocialMediaItems={initialSocialMedia.items}
			initialSocialMediaTotal={initialSocialMedia.total}
			isPublished={publishedId != null}
			roles={roles}
			scopes={scopes}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			selectedSocialMediaItems={selectedSocialMediaItems}
		/>
	);
}
