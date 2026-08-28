import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryRoleWizard } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_components/country-role-wizard";
import { countryRoleTypes } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-registry";
import { assertAdminPageAccess } from "@/lib/auth/session";
import { getContributionPersonOptions } from "@/lib/data/contributions";
import { getOrganisationalUnitOptions } from "@/lib/data/organisational-units";
import { getCountryRoleCounterpartOptions } from "@/lib/data/wizard-preflight";
import { toOrganisationalUnitDocumentOptionsPage } from "@/lib/organisational-unit-options";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryRoleWizardPageProps extends PageProps<"/[locale]/dashboard/administrator/guided-forms/country-role"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryRoleWizardPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Guided forms - Start or end a national coordinator or representative appointment"),
	});

	return metadata;
}

export default async function DashboardAdministratorCountryRoleWizardPage(
	_props: Readonly<DashboardAdministratorCountryRoleWizardPageProps>,
): Promise<ReactNode> {
	await assertAdminPageAccess();

	const [persons, countries] = await Promise.all([
		getContributionPersonOptions({ includeDrafts: true }),
		getOrganisationalUnitOptions({ unitType: "country" }),
	]);

	const initialCountries = toOrganisationalUnitDocumentOptionsPage(countries);

	return (
		<CountryRoleWizard
			counterpartRoleOptions={getCountryRoleCounterpartOptions()}
			initialCountryItems={initialCountries.items}
			initialCountryTotal={initialCountries.total}
			initialPersonItems={persons.items}
			initialPersonTotal={persons.total}
			roleTypes={countryRoleTypes}
		/>
	);
}
