import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { SocialMediaCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/social-media/_components/social-media-create-form";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCreateSocialMediaPageProps extends PageProps<"/[locale]/dashboard/administrator/social-media/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCreateSocialMediaPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - New social media"),
	});

	return metadata;
}

export default function DashboardAdministratorCreateSocialMediaPage(
	_props: Readonly<DashboardAdministratorCreateSocialMediaPageProps>,
): ReactNode {
	return <SocialMediaCreateForm />;
}
