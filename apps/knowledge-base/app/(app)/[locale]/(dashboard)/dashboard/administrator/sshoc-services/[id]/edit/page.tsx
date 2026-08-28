import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ServiceStatusEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/sshoc-services/_components/service-status-edit-form";
import { assertAuthenticated } from "@/lib/auth/session";
import { getServiceForAdmin } from "@/lib/data/services";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditSshocServicePageProps extends PageProps<"/[locale]/dashboard/administrator/sshoc-services/[id]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditSshocServicePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit SSHOC service"),
	});

	return metadata;
}

export default async function DashboardAdministratorEditSshocServicePage(
	props: Readonly<DashboardAdministratorEditSshocServicePageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const serviceData = await getServiceForAdmin(user, id);

	if (serviceData?.service.sshocMarketplaceId == null) {
		notFound();
	}

	return (
		<ServiceStatusEditForm
			service={serviceData.service}
			serviceStatuses={serviceData.serviceStatuses}
		/>
	);
}
