import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { DocumentationPageCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_components/documentation-page-create-form";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCreateDocumentationPageProps extends PageProps<"/[locale]/dashboard/administrator/documentation-pages/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCreateDocumentationPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Create documentation page"),
	});
}

export default function DashboardAdministratorCreateDocumentationPage(
	_props: Readonly<DashboardAdministratorCreateDocumentationPageProps>,
): ReactNode {
	return <DocumentationPageCreateForm />;
}
