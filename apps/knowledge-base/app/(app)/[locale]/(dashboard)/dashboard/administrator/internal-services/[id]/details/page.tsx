import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ServiceDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-services/_components/service-details";
import { assertAuthenticated } from "@/lib/auth/session";
import { getServiceForAdmin } from "@/lib/data/services";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorServiceDetailsPageProps extends PageProps<"/[locale]/dashboard/administrator/internal-services/[id]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorServiceDetailsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - View internal service"),
	});

	return metadata;
}

export default async function DashboardAdministratorServiceDetailsPage(
	props: Readonly<DashboardAdministratorServiceDetailsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const serviceData = await getServiceForAdmin(user, id);

	if (serviceData == null) {
		notFound();
	}

	return (
		<ServiceDetails
			initialOrganisationalUnitItems={serviceData.initialOrganisationalUnits.items}
			initialOrganisationalUnitTotal={serviceData.initialOrganisationalUnits.total}
			selectedOrganisationalUnits={serviceData.selectedOrganisationalUnits}
			service={serviceData.service}
			serviceStatuses={serviceData.serviceStatuses}
		/>
	);
}
