import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { RetireUnitWizard } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_components/retire-unit-wizard";
import { assertAdminPageAccess } from "@/lib/auth/session";
import { getOrganisationalUnitOptions } from "@/lib/data/organisational-units";
import { retirableUnitTypes } from "@/lib/data/wizard-preflight";
import { toOrganisationalUnitDocumentOptionsPage } from "@/lib/organisational-unit-options";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorRetireUnitWizardPageProps extends PageProps<"/[locale]/dashboard/administrator/guided-forms/retire-unit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorRetireUnitWizardPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Guided forms - End a working group or a country's membership"),
	});

	return metadata;
}

export default async function DashboardAdministratorRetireUnitWizardPage(
	_props: Readonly<DashboardAdministratorRetireUnitWizardPageProps>,
): Promise<ReactNode> {
	await assertAdminPageAccess();

	// Which subtypes can be retired is decided by `inactiveUnitRelationRules`, not by this page.
	const units = await getOrganisationalUnitOptions({
		unitType: retirableUnitTypes[0],
	});

	const initialUnits = toOrganisationalUnitDocumentOptionsPage(units);

	return (
		<RetireUnitWizard
			initialUnitItems={initialUnits.items}
			initialUnitTotal={initialUnits.total}
			unitTypes={retirableUnitTypes}
		/>
	);
}
