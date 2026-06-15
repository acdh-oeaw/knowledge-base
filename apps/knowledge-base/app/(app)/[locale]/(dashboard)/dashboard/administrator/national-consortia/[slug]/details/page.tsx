import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { NationalConsortiumDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/national-consortia/_components/national-consortia-details";
import { publishNationalConsortiumAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/national-consortia/_lib/publish-national-consortium.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getOrganisationalUnitEditDataForAdmin } from "@/lib/data/admin-organisational-units";
import { resolveSelectedDetailVersion } from "@/lib/data/entity-detail-view";
import { db } from "@/lib/db";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorNationalConsortiumDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/national-consortia/[slug]/details"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorNationalConsortiumDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - View national consortium"),
	});

	return metadata;
}

export default async function DashboardAdministratorNationalConsortiumDetailsPage(
	props: Readonly<DashboardAdministratorNationalConsortiumDetailsPageProps>,
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

	const nationalConsortiumData = await getOrganisationalUnitEditDataForAdmin(user, {
		slug,
		unitType: "national_consortium",
		versionId,
		publishedVersionId: publishedId,
	});

	if (nationalConsortiumData == null) {
		notFound();
	}

	const {
		relations,
		selectedRelatedEntities,
		selectedRelatedResources,
		selectedSocialMediaItems,
		unit: nationalConsortium,
	} = nationalConsortiumData;

	const image =
		nationalConsortium.image != null
			? {
					...nationalConsortium.image,
					url: images.generateSignedImageUrl({
						key: nationalConsortium.image.key,
						options: imageGridOptions,
					}).url,
				}
			: null;

	return (
		<NationalConsortiumDetails
			documentId={documentId}
			hasDraft={hasDraftChanges}
			isPublished={publishedId != null}
			nationalConsortium={{ ...nationalConsortium, image }}
			relations={relations}
			selectedRelatedEntities={selectedRelatedEntities}
			selectedRelatedResources={selectedRelatedResources}
			selectedSocialMediaItems={selectedSocialMediaItems}
			publishAction={publishNationalConsortiumAction}
			selectedVersion={selectedVersion}
		/>
	);
}
