import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { PersonCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_components/person-create-form";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getPersonCreateDataForAdmin } from "@/lib/data/cached/persons";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCreatePersonPageProps extends PageProps<"/[locale]/dashboard/administrator/persons/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCreatePersonPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Create person"),
	});

	return metadata;
}

export default async function DashboardAdministratorCreatePersonPage(
	_props: Readonly<DashboardAdministratorCreatePersonPageProps>,
): Promise<ReactNode> {
	const { items: initialAssets } = await getMediaLibraryAssets({
		imageUrlOptions: imageGridOptions,
		prefix: "avatars",
	});

	const { user } = await assertAuthenticated();
	const { initialSocialMedia } = await getPersonCreateDataForAdmin(user);

	return (
		<PersonCreateForm
			initialAssets={initialAssets}
			initialSocialMediaItems={initialSocialMedia.items}
			initialSocialMediaTotal={initialSocialMedia.total}
		/>
	);
}
