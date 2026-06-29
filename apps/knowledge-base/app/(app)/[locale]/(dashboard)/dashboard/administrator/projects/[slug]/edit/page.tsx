import * as schema from "@acdh-knowledge-base/database/schema";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProjectEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-edit-form";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { ensureDraftVersion, getDocumentLifecycleState } from "@/lib/data/entity-lifecycle";
import { projectsLifecycleAdapter } from "@/lib/data/projects.lifecycle-adapter";
import { getSocialMediaOptions, getSocialMediaOptionsByIds } from "@/lib/data/social-media";
import { db } from "@/lib/db";
import { alias, eq } from "@/lib/db/sql";
import { images } from "@/lib/images";
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
	const { params } = props;

	const { slug } = await params;

	await assertAuthenticated();

	const anyVersion = await db.query.projects.findFirst({
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

	const { draftVersionId, hasDraftChanges, publishedId } = await db.transaction(async (tx) => {
		const draftVersionId = await ensureDraftVersion(tx, documentId, projectsLifecycleAdapter);
		const { hasDraftChanges, publishedId } = await getDocumentLifecycleState(tx, documentId);
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
								slug: true,
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
			},
		}),
	]);

	if (project == null) {
		notFound();
	}

	const [
		descriptionContentBlocks,
		scopes,
		roles,
		initialSocialMedia,
		existingPartners,
		existingPersons,
		existingSocialMedia,
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
		(() => {
			const personDocumentLifecycle = alias(schema.documentLifecycle, "person_document_lifecycle");
			return db
				.select({
					id: schema.projectsToPersons.id,
					personDocumentId: schema.projectsToPersons.personDocumentId,
					personName: schema.persons.name,
					roleId: schema.projectsToPersons.roleId,
					roleName: schema.projectRoles.role,
					duration: schema.projectsToPersons.duration,
				})
				.from(schema.projectsToPersons)
				.innerJoin(
					personDocumentLifecycle,
					eq(personDocumentLifecycle.documentId, schema.projectsToPersons.personDocumentId),
				)
				.innerJoin(schema.persons, eq(schema.persons.id, personDocumentLifecycle.publishedId))
				.innerJoin(schema.projectRoles, eq(schema.projectRoles.id, schema.projectsToPersons.roleId))
				.where(eq(schema.projectsToPersons.projectDocumentId, documentId));
		})(),
		db.query.projectsToSocialMedia.findMany({
			where: { projectId: project.id },
			columns: { socialMediaId: true },
		}),
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

	const initialPersons = existingPersons.map((person) => {
		return {
			id: person.id,
			personDocumentId: person.personDocumentId,
			personName: person.personName,
			roleId: person.roleId,
			roleName: person.roleName,
			durationStart: person.duration?.start ?? null,
			durationEnd: person.duration?.end ?? null,
		};
	});

	const initialSocialMediaIds = existingSocialMedia.map((row) => row.socialMediaId);

	const selectedSocialMediaItems = await getSocialMediaOptionsByIds(initialSocialMediaIds);

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
		<ProjectEditForm
			documentId={documentId}
			hasDraftChanges={hasDraftChanges}
			initialAssets={initialAssets}
			initialPartners={initialPartners}
			initialPersons={initialPersons}
			initialSocialMediaIds={initialSocialMediaIds}
			initialSocialMediaItems={initialSocialMedia.items}
			initialSocialMediaTotal={initialSocialMedia.total}
			isPublished={publishedId != null}
			project={{ ...project, descriptionContentBlocks, image }}
			roles={roles}
			scopes={scopes}
			selectedSocialMediaItems={selectedSocialMediaItems}
		/>
	);
}
