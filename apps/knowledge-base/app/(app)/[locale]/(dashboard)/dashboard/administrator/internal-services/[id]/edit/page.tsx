import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ServiceEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-services/_components/service-edit-form";
import { assertAuthenticated } from "@/lib/auth/session";
import { getServiceForAdmin } from "@/lib/data/services";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditServicePageProps extends PageProps<"/[locale]/dashboard/administrator/internal-services/[id]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditServicePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit internal service"),
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

	if (serviceData == null || serviceData.service.sshocMarketplaceId != null) {
		notFound();
	}

	return (
		<ServiceEditForm
			initialOrganisationalUnitItems={serviceData.initialOrganisationalUnits.items}
			initialOrganisationalUnitTotal={serviceData.initialOrganisationalUnits.total}
			selectedOrganisationalUnits={serviceData.selectedOrganisationalUnits}
			service={serviceData.service}
			serviceStatuses={serviceData.serviceStatuses}
			serviceTypes={serviceData.serviceTypes}
		/>
	);
}
