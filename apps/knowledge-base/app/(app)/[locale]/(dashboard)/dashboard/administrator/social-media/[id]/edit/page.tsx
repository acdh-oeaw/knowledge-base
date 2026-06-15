import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SocialMediaEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/social-media/_components/social-media-edit-form";
import { assertAuthenticated } from "@/lib/auth/session";
import { getSocialMediaByIdForAdmin } from "@/lib/data/social-media";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditSocialMediaPageProps extends PageProps<"/[locale]/dashboard/administrator/social-media/[id]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditSocialMediaPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit social media"),
	});

	return metadata;
}

export default async function DashboardAdministratorEditSocialMediaPage(
	props: Readonly<DashboardAdministratorEditSocialMediaPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const socialMedia = await getSocialMediaByIdForAdmin(user, id);

	if (socialMedia == null) {
		notFound();
	}

	const durationStart =
		socialMedia.duration?.start != null
			? socialMedia.duration.start.toISOString().slice(0, 10)
			: null;

	const durationEnd =
		socialMedia.duration?.end != null ? socialMedia.duration.end.toISOString().slice(0, 10) : null;

	return <SocialMediaEditForm socialMedia={{ ...socialMedia, durationStart, durationEnd }} />;
}
