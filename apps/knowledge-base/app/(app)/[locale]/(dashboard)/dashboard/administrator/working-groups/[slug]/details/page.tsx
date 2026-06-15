import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WorkingGroupDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_components/working-group-details";
import { publishWorkingGroupAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_lib/publish-working-group.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getOrganisationalUnitEditDataForAdmin } from "@/lib/data/admin-organisational-units";
import { resolveSelectedDetailVersion } from "@/lib/data/entity-detail-view";
import { getPersonRelations } from "@/lib/data/person-relations";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorWorkingGroupDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/working-groups/[slug]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorWorkingGroupDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - View working group"),
	});

	return metadata;
}

export default async function DashboardAdministratorWorkingGroupDetailsPage(
	props: Readonly<DashboardAdministratorWorkingGroupDetailsPageProps>,
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

	const [personRelations, workingGroupData] = await Promise.all([
		getPersonRelations(documentId),
		getOrganisationalUnitEditDataForAdmin(user, {
			slug,
			unitType: "working_group",
			versionId,
			publishedVersionId: publishedId,
		}),
	]);

	if (workingGroupData == null) {
		notFound();
	}

	const {
		relations,
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedSocialMediaItems,
		unit: workingGroup,
	} = workingGroupData;

	const image =
		workingGroup.image != null
			? {
					...workingGroup.image,
					url: images.generateSignedImageUrl({
						key: workingGroup.image.key,
						options: imageGridOptions,
					}).url,
				}
			: null;

	return (
		<WorkingGroupDetails
			documentId={documentId}
			hasDraft={hasDraftChanges}
			isPublished={publishedId != null}
			personRelations={personRelations}
			relations={relations}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			selectedSocialMediaItems={selectedSocialMediaItems}
			workingGroup={{ ...workingGroup, image }}
			publishAction={publishWorkingGroupAction}
			selectedVersion={selectedVersion}
		/>
	);
}
