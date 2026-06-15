import * as schema from "@acdh-knowledge-base/database/schema";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProjectDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-details";
import { discardProjectDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/discard-project-draft.action";
import { publishProjectAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/publish-project.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { resolveSelectedDetailVersion } from "@/lib/data/entity-detail-view";
import { db } from "@/lib/db";
import { alias, eq, sql } from "@/lib/db/sql";
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

	const { version } = await searchParamsPromise;

	const versionState = await resolveSelectedDetailVersion(documentId, version);
	if (versionState == null) {
		notFound();
	}
	const { hasDraftChanges, publishedId, selectedVersion, versionId } = versionState;

	const project = await db.query.projects.findFirst({
		where: { id: versionId },
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
	});

	if (project == null) {
		notFound();
	}

	const [descriptionContentBlocks, partners, socialMediaLinks] = await Promise.all([
		getEntityContentBlocks(versionId, "description"),
		(() => {
			const unitDocumentLifecycle = alias(schema.documentLifecycle, "unit_document_lifecycle");
			return db
				.select({
					id: schema.projectsToOrganisationalUnits.id,
					duration: schema.projectsToOrganisationalUnits.duration,
					unitName: schema.organisationalUnits.name,
					unitSlug: schema.entities.slug,
					unitType: schema.organisationalUnitTypes.type,
					roleName: schema.projectRoles.role,
				})
				.from(schema.projectsToOrganisationalUnits)
				.innerJoin(
					schema.entities,
					eq(schema.entities.id, schema.projectsToOrganisationalUnits.unitDocumentId),
				)
				.innerJoin(
					unitDocumentLifecycle,
					eq(unitDocumentLifecycle.documentId, schema.projectsToOrganisationalUnits.unitDocumentId),
				)
				.innerJoin(
					schema.organisationalUnits,
					sql`${schema.organisationalUnits.id} = COALESCE(${unitDocumentLifecycle.publishedId}, ${unitDocumentLifecycle.draftId})`,
				)
				.innerJoin(
					schema.organisationalUnitTypes,
					eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
				)
				.innerJoin(
					schema.projectRoles,
					eq(schema.projectRoles.id, schema.projectsToOrganisationalUnits.roleId),
				)
				.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, documentId));
		})(),
		db.query.projectsToSocialMedia.findMany({
			where: { projectId: project.id },
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
			isPublished={publishedId != null}
			project={{
				...project,
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
					};
				}),
				socialMedia: socialMediaLinks.map((link) => link.socialMedia),
			}}
			publishAction={publishProjectAction}
			selectedVersion={selectedVersion}
		/>
	);
}
