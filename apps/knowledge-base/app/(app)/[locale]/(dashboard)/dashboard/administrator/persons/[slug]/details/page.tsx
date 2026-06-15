import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PersonDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_components/person-details";
import { discardPersonDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/discard-person-draft.action";
import { publishPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/publish-person.action";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getEntityContentBlocks } from "@/lib/content-blocks-service";
import { getPersonContributions } from "@/lib/data/contributions";
import { resolveSelectedDetailVersion } from "@/lib/data/entity-detail-view";
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

	await assertAuthenticated();

	const anyVersion = await db.query.persons.findFirst({
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
		},
	});

	if (person == null) {
		notFound();
	}

	const [contributions, biographyContentBlocks] = await Promise.all([
		getPersonContributions(documentId),
		getEntityContentBlocks(versionId, "biography"),
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
			isPublished={publishedId != null}
			person={{ ...person, biographyContentBlocks, image }}
			publishAction={publishPersonAction}
			selectedVersion={selectedVersion}
		/>
	);
}
