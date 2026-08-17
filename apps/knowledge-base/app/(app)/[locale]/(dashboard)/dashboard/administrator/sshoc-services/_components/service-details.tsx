"use client";

import type * as schema from "@dariah-eric/database/schema";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@dariah-eric/ui/description-list";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import { RelationLink } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-link";
import { getOrganisationalUnitDetailHref } from "@/lib/entity-detail-href";

interface ServiceDetailsProps {
	service: Pick<
		schema.Service,
		| "id"
		| "name"
		| "sshocMarketplaceId"
		| "comment"
		| "dariahBranding"
		| "monitoring"
		| "privateSupplier"
	> & {
		status: Pick<schema.ServiceStatus, "status">;
		type: Pick<schema.ServiceType, "type">;
		ownerUnitDocumentIds: Array<string>;
		providerUnitDocumentIds: Array<string>;
	};
	selectedOrganisationalUnitItems: Array<{ id: string; name: string; type: string; slug: string }>;
}

export function ServiceDetails(props: Readonly<ServiceDetailsProps>): ReactNode {
	const { service, selectedOrganisationalUnitItems } = props;

	const t = useExtracted();

	const owners = selectedOrganisationalUnitItems.filter((orgaUnit) =>
		service.ownerUnitDocumentIds.includes(orgaUnit.id),
	);
	const providers = selectedOrganisationalUnitItems.filter((orgaUnit) =>
		service.providerUnitDocumentIds.includes(orgaUnit.id),
	);

	return (
		<DescriptionList>
			<DescriptionTerm>{t("Name")}</DescriptionTerm>
			<DescriptionDetails>{service.name}</DescriptionDetails>
			<DescriptionTerm>{t("Type")}</DescriptionTerm>
			<DescriptionDetails>{service.type.type}</DescriptionDetails>
			<DescriptionTerm>{t("Status")}</DescriptionTerm>
			<DescriptionDetails>{service.status.status}</DescriptionDetails>
			<DescriptionTerm>{t("SSHOC Marketplace ID")}</DescriptionTerm>
			<DescriptionDetails>{service.sshocMarketplaceId}</DescriptionDetails>
			<DescriptionTerm>{t("Comment")}</DescriptionTerm>
			<DescriptionDetails>{service.comment}</DescriptionDetails>
			<DescriptionTerm>{t("Service owners")}</DescriptionTerm>
			<DescriptionDetails>
				{owners.length > 0 ? (
					<ul className="flex flex-col gap-1">
						{owners.map((owner) => (
							<li key={owner.id} className="text-sm">
								<RelationLink
									className="font-medium"
									href={getOrganisationalUnitDetailHref(owner.type, owner.slug)}
								>
									{owner.name}
								</RelationLink>
							</li>
						))}
					</ul>
				) : null}
			</DescriptionDetails>
			<DescriptionTerm>{t("Service providers")}</DescriptionTerm>
			<DescriptionDetails>
				{providers.length > 0 ? (
					<ul className="flex flex-col gap-1">
						{providers.map((provider) => (
							<li key={provider.id} className="text-sm">
								<RelationLink
									className="font-medium"
									href={getOrganisationalUnitDetailHref(provider.type, provider.slug)}
								>
									{provider.name}
								</RelationLink>
							</li>
						))}
					</ul>
				) : null}
			</DescriptionDetails>
		</DescriptionList>
	);
}
