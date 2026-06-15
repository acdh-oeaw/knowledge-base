import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { EricDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/eric/_components/eric-details";
import { publishEricAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/eric/_lib/publish-eric.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getOrganisationalUnitEditDataForAdmin } from "@/lib/data/admin-organisational-units";
import { resolveSelectedDetailVersion } from "@/lib/data/entity-detail-view";
import { getEricReverseRelationGroups } from "@/lib/data/eric";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEricDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/eric/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEricDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - View DARIAH ERIC"),
	});

	return metadata;
}

export default async function DashboardAdministratorEricDetailsPage(
	props: Readonly<DashboardAdministratorEricDetailsPageProps>,
): Promise<ReactNode> {
	const { params, searchParams: searchParamsPromise } = props;

	const { slug } = await params;
	const { user } = await assertAuthenticated();

	const anyVersion = await db.query.organisationalUnits.findFirst({
		where: { entityVersion: { entity: { slug } }, type: { type: "eric" } },
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

	const [ericData, reverseRelationGroups] = await Promise.all([
		getOrganisationalUnitEditDataForAdmin(user, {
			slug,
			unitType: "eric",
			versionId,
			publishedVersionId: publishedId,
		}),
		getEricReverseRelationGroups(documentId),
	]);

	if (ericData == null) {
		notFound();
	}

	const {
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedSocialMediaItems,
		unit: eric,
	} = ericData;

	const image =
		eric.image != null
			? {
					...eric.image,
					url: images.generateSignedImageUrl({
						key: eric.image.key,
						options: imageGridOptions,
					}).url,
				}
			: null;

	return (
		<EricDetails
			documentId={documentId}
			eric={{ ...eric, image }}
			hasDraft={hasDraftChanges}
			isPublished={publishedId != null}
			publishAction={publishEricAction}
			reverseRelationGroups={reverseRelationGroups}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			selectedSocialMediaItems={selectedSocialMediaItems}
			selectedVersion={selectedVersion}
		/>
	);
}
