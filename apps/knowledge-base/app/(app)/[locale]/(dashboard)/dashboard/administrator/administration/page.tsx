import { Heading } from "@dariah-eric/ui/heading";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { Fragment, type ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministrationPageProps extends PageProps<"/[locale]/dashboard/administrator/administration"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministrationPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administration"),
	});

	return metadata;
}

export default async function DashboardAdministrationPage(
	_props: Readonly<DashboardAdministrationPageProps>,
): Promise<ReactNode> {
	const t = await getExtracted();

	return (
		<Fragment>
			<Heading>{t("Administration")}</Heading>
			<Header className="my-(--layout-gutter) border-bs">
				<HeaderContent>
					<HeaderTitle>{t("Lorem ipsum")}</HeaderTitle>
					<HeaderDescription>
						{t(
							"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
						)}
					</HeaderDescription>
				</HeaderContent>
			</Header>
			<div className="grid grid-cols-1 gap-2 md:grid-cols-2"></div>
		</Fragment>
	);
}
