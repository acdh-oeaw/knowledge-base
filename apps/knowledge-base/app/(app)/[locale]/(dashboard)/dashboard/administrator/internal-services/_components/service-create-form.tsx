"use client";

import type * as schema from "@dariah-eric/database/schema";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { ServiceForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-services/_components/service-form";
import { createServiceAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-services/_lib/create-service.action";

interface ServiceCreateFormProps {
	serviceTypes: Array<Pick<schema.ServiceType, "id" | "type">>;
	serviceStatuses: Array<Pick<schema.ServiceStatus, "id" | "status">>;
	initialOrganisationalUnitItems: Array<{ id: string; name: string }>;
	initialOrganisationalUnitTotal: number;
}

export function ServiceCreateForm(props: Readonly<ServiceCreateFormProps>): ReactNode {
	const { serviceStatuses, initialOrganisationalUnitItems, initialOrganisationalUnitTotal } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New internal service")} />

			<ServiceForm
				formAction={createServiceAction}
				initialOrganisationalUnitItems={initialOrganisationalUnitItems}
				initialOrganisationalUnitTotal={initialOrganisationalUnitTotal}
				serviceStatuses={serviceStatuses}
			/>
		</Fragment>
	);
}
