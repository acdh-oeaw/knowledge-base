import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ProjectCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_components/project-create-form";
import { imageGridOptions } from "@/config/assets.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { getProjectCreateDataForAdmin } from "@/lib/data/cached/projects";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCreateProjectPageProps extends PageProps<"/[locale]/dashboard/administrator/projects/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCreateProjectPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Create project"),
	});

	return metadata;
}

export default async function DashboardAdministratorCreateProjectPage(
	_props: Readonly<DashboardAdministratorCreateProjectPageProps>,
): Promise<ReactNode> {
	const { items: initialAssets } = await getMediaLibraryAssets({
		imageUrlOptions: imageGridOptions,
		prefix: "logos",
	});

	const { user } = await assertAuthenticated();
	const { initialSocialMedia, scopes } = await getProjectCreateDataForAdmin(user);

	return (
		<ProjectCreateForm
			initialAssets={initialAssets}
			initialSocialMediaItems={initialSocialMedia.items}
			initialSocialMediaTotal={initialSocialMedia.total}
			scopes={scopes}
		/>
	);
}
