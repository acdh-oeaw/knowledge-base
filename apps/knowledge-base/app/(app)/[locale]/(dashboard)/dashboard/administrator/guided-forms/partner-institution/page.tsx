import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { PartnerInstitutionWizard } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_components/partner-institution-wizard";
import { assertAdminPageAccess } from "@/lib/auth/session";
import { getOrganisationalUnitOptions } from "@/lib/data/organisational-units";
import { getUnitReferenceBySlug, partnerInstitutionStatusTypes } from "@/lib/data/wizard-preflight";
import { db } from "@/lib/db";
import { toOrganisationalUnitDocumentOptionsPage } from "@/lib/organisational-unit-options";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorPartnerInstitutionWizardPageProps extends PageProps<"/[locale]/dashboard/administrator/guided-forms/partner-institution"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorPartnerInstitutionWizardPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Guided forms - Record an institution's status towards DARIAH-EU"),
	});

	return metadata;
}

export default async function DashboardAdministratorPartnerInstitutionWizardPage(
	_props: Readonly<DashboardAdministratorPartnerInstitutionWizardPageProps>,
): Promise<ReactNode> {
	await assertAdminPageAccess();

	const t = await getExtracted();

	const [institutions, countries, eric] = await Promise.all([
		getOrganisationalUnitOptions({ unitType: "institution", includeDrafts: true }),
		getOrganisationalUnitOptions({ unitType: "country" }),
		getUnitReferenceBySlug(db, "dariah-eu"),
	]);

	const initialInstitutions = toOrganisationalUnitDocumentOptionsPage(institutions);
	const initialCountries = toOrganisationalUnitDocumentOptionsPage(countries);

	return (
		<PartnerInstitutionWizard
			ericName={eric?.name ?? t("DARIAH-EU")}
			initialCountryItems={initialCountries.items}
			initialCountryTotal={initialCountries.total}
			initialInstitutionItems={initialInstitutions.items}
			initialInstitutionTotal={initialInstitutions.total}
			statusTypes={partnerInstitutionStatusTypes}
		/>
	);
}
