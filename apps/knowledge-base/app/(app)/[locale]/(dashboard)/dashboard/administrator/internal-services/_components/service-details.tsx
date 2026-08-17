"use client";

import type * as schema from "@dariah-eric/database/schema";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@dariah-eric/ui/description-list";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { RelationLink } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-link";
import { getOrganisationalUnitDetailHref } from "@/lib/entity-detail-href";

interface ServiceDetailsProps {
	service: Pick<
		schema.Service,
		"id" | "name" | "statusId" | "comment" | "dariahBranding" | "monitoring" | "privateSupplier"
	> & {
		ownerUnitDocumentIds: Array<string>;
		providerUnitDocumentIds: Array<string>;
	};
	serviceStatuses: Array<Pick<schema.ServiceStatus, "id" | "status">>;
	initialOrganisationalUnitItems: Array<{ id: string; name: string }>;
	initialOrganisationalUnitTotal: number;
	selectedOrganisationalUnits: Array<{ id: string; name: string; type: string; slug: string }>;
}

export function ServiceDetails(props: Readonly<ServiceDetailsProps>): ReactNode {
	const { service, serviceStatuses, selectedOrganisationalUnits } = props;

	const t = useExtracted();

	const owners = selectedOrganisationalUnits.filter((orgaUnit) =>
		service.ownerUnitDocumentIds.includes(orgaUnit.id),
	);
	const providers = selectedOrganisationalUnits.filter((orgaUnit) =>
		service.providerUnitDocumentIds.includes(orgaUnit.id),
	);

	return (
		<Fragment>
			<DescriptionList>
				<DescriptionTerm>{t("Name")}</DescriptionTerm>
				<DescriptionDetails>{service.name}</DescriptionDetails>

				<DescriptionTerm>{t("Status")}</DescriptionTerm>
				<DescriptionDetails>
					{serviceStatuses.find((s) => s.id === service.statusId)?.status}
				</DescriptionDetails>

				<DescriptionTerm>{t("Comment")}</DescriptionTerm>
				<DescriptionDetails>{service.comment}</DescriptionDetails>

				<DescriptionTerm>{t("DARIAH branding")}</DescriptionTerm>
				<DescriptionDetails>
					{service.dariahBranding !== null ? t("Yes") : t("No")}
				</DescriptionDetails>

				<DescriptionTerm>{t("Monitoring")}</DescriptionTerm>
				<DescriptionDetails>{service.monitoring !== null ? t("Yes") : t("No")}</DescriptionDetails>

				<DescriptionTerm>{t("Private supplier")}</DescriptionTerm>
				<DescriptionDetails>
					{service.privateSupplier !== null ? t("Yes") : t("No")}
				</DescriptionDetails>

				<DescriptionTerm>{t("Owners")}</DescriptionTerm>
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

				<DescriptionTerm>{t("Providers")}</DescriptionTerm>
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
