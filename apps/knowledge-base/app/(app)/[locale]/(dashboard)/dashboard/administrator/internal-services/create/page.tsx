import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ServiceCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-services/_components/service-create-form";
import { assertAuthenticated } from "@/lib/auth/session";
import { getServiceCreateDataForAdmin } from "@/lib/data/services";
import { createMetadata } from "@/lib/server/create-metadata";

export async function generateMetadata(
	_props: unknown,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - New internal service"),
	});

	return metadata;
}

export default async function DashboardAdministratorCreateServicePage(
	_props: unknown,
): Promise<ReactNode> {
	const { user } = await assertAuthenticated();
	const { initialOrganisationalUnits, serviceStatuses, serviceTypes } =
		await getServiceCreateDataForAdmin(user);

	return (
		<ServiceCreateForm
			initialOrganisationalUnitItems={initialOrganisationalUnits.items}
			initialOrganisationalUnitTotal={initialOrganisationalUnits.total}
			serviceStatuses={serviceStatuses}
			serviceTypes={serviceTypes}
		/>
	);
}
