import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ServiceDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/sshoc-services/_components/service-details";
import { env } from "@/config/env.config";
import { assertAuthenticated } from "@/lib/auth/session";
import { getServiceForAdmin } from "@/lib/data/services";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditServicePageProps extends PageProps<"/[locale]/dashboard/administrator/sshoc-services/[id]/view"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditServicePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - View SSHOC service"),
	});

	return metadata;
}

export default async function DashboardAdministratorEditServicePage(
	props: Readonly<DashboardAdministratorEditServicePageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const serviceData = await getServiceForAdmin(user, id);

	if (serviceData?.service.sshocMarketplaceId == null) {
		notFound();
	}

	return (
		<ServiceDetails
			selectedOrganisationalUnitItems={serviceData.selectedOrganisationalUnits}
			service={serviceData.service}
			sshocMarketplaceBaseUrl={env.SSHOC_MARKETPLACE_BASE_URL ?? null}
		/>
	);
}
