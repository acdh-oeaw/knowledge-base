import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { EricPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/eric/_components/eric-page";
import { assertAuthenticated } from "@/lib/auth/session";
import { getEricForAdmin } from "@/lib/data/eric";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEricPageProps extends PageProps<"/[locale]/dashboard/administrator/eric"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEricPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - DARIAH ERIC"),
	});

	return metadata;
}

export default async function DashboardAdministratorEricPage(
	_props: Readonly<DashboardAdministratorEricPageProps>,
): Promise<ReactNode> {
	const { user } = await assertAuthenticated();

	const eric = await getEricForAdmin(user);

	if (eric == null) {
		notFound();
	}

	return <EricPage eric={eric} />;
}
