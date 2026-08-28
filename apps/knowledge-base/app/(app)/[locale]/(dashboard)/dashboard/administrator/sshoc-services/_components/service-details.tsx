"use client";

import type * as schema from "@dariah-eric/database/schema";
import { buttonStyles } from "@dariah-eric/ui/button-styles";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@dariah-eric/ui/description-list";
import { Link } from "@dariah-eric/ui/link";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { RelationLink } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-link";
import { getOrganisationalUnitDetailHref } from "@/lib/entity-detail-href";
import { getSshocMarketplaceServiceUrl } from "@/lib/external-identifier-url";
import { getServiceStatusLabel } from "@/lib/service-status-label";

interface ServiceDetailsProps {
	service: Pick<
		schema.Service,
		| "id"
		| "name"
		| "statusId"
		| "sshocMarketplaceId"
		| "comment"
		| "dariahBranding"
		| "monitoring"
		| "privateSupplier"
	> & {
		type: Pick<schema.ServiceType, "type">;
		status: Pick<schema.ServiceStatus, "status">;
		ownerUnitDocumentIds: Array<string>;
		providerUnitDocumentIds: Array<string>;
	};
	selectedOrganisationalUnitItems: Array<{ id: string; name: string; type: string; slug: string }>;
	sshocMarketplaceBaseUrl: string | null;
}

export function ServiceDetails(props: Readonly<ServiceDetailsProps>): ReactNode {
	const { service, selectedOrganisationalUnitItems, sshocMarketplaceBaseUrl } = props;

	const t = useExtracted();

	const sshocMarketplaceUrl = getSshocMarketplaceServiceUrl(
		service.sshocMarketplaceId,
		sshocMarketplaceBaseUrl,
	);

	const owners = selectedOrganisationalUnitItems.filter((orgaUnit) =>
		service.ownerUnitDocumentIds.includes(orgaUnit.id),
	);
	const providers = selectedOrganisationalUnitItems.filter((orgaUnit) =>
		service.providerUnitDocumentIds.includes(orgaUnit.id),
	);

	return (
		<Fragment>
			<div className="flex items-center justify-end">
				<Link
					className={buttonStyles({ intent: "secondary", size: "sm" })}
					href={`/dashboard/administrator/sshoc-services/${service.id}/edit`}
				>
					<PencilSquareIcon data-slot="icon" />
					{t("Edit")}
				</Link>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Name")}</DescriptionTerm>
				<DescriptionDetails>{service.name}</DescriptionDetails>

				<DescriptionTerm>{t("Status")}</DescriptionTerm>
				<DescriptionDetails>{getServiceStatusLabel(service.status.status)}</DescriptionDetails>

				<DescriptionTerm>{t("Type")}</DescriptionTerm>
				<DescriptionDetails>{service.type.type}</DescriptionDetails>

				<DescriptionTerm>{t("SSHOC Marketplace ID")}</DescriptionTerm>
				<DescriptionDetails>
					{sshocMarketplaceUrl != null ? (
						<a className="underline" href={sshocMarketplaceUrl} rel="noreferrer" target="_blank">
							{service.sshocMarketplaceId}
						</a>
					) : (
						service.sshocMarketplaceId
					)}
				</DescriptionDetails>

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
		</Fragment>
	);
}
