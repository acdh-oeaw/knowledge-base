import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { type ReactNode, Suspense } from "react";

import { CountryMembershipSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/country-membership-section";
import { EmptyContentBlocksSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/empty-content-blocks-section";
import { HeadingHierarchySection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/heading-hierarchy-section";
import { InactiveUnitRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/inactive-unit-relations-section";
import { MaintenanceDashboard } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/maintenance-dashboard";
import { MaintenanceSectionFallback } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/maintenance-section-fallback";
import { MutuallyExclusiveRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/mutually-exclusive-relations-section";
import { PairedRelationsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/paired-relations-section";
import { RichTextSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/richtext-section";
import { UnitRelationRequirementsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/unit-relation-requirements-section";
import { UnusedAssetsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/unused-assets-section";
import { UnusedSocialMediaSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/unused-social-media-section";
import { WebAddressesSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/web-addresses-section";
import { assertAdminPageAccess } from "@/lib/auth/session";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorMaintenancePageProps extends PageProps<"/[locale]/dashboard/administrator/maintenance"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorMaintenancePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Maintenance"),
	});

	return metadata;
}

export default async function DashboardAdministratorMaintenancePage(
	_props: Readonly<DashboardAdministratorMaintenancePageProps>,
): Promise<ReactNode> {
	await assertAdminPageAccess();

	return (
		<MaintenanceDashboard
			countryMembership={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<CountryMembershipSection />
				</Suspense>
			}
			emptyContentBlocks={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<EmptyContentBlocksSection />
				</Suspense>
			}
			headingHierarchy={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<HeadingHierarchySection />
				</Suspense>
			}
			inactiveUnitRelations={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<InactiveUnitRelationsSection />
				</Suspense>
			}
			mutuallyExclusiveRelations={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<MutuallyExclusiveRelationsSection />
				</Suspense>
			}
			pairedRelations={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<PairedRelationsSection />
				</Suspense>
			}
			richText={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<RichTextSection />
				</Suspense>
			}
			unitRelationRequirements={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<UnitRelationRequirementsSection />
				</Suspense>
			}
			unusedAssets={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<UnusedAssetsSection />
				</Suspense>
			}
			unusedSocialMedia={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<UnusedSocialMediaSection />
				</Suspense>
			}
			webAddresses={
				<Suspense fallback={<MaintenanceSectionFallback />}>
					<WebAddressesSection />
				</Suspense>
			}
		/>
	);
}
