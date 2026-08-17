import { db } from "@dariah-eric/database/client";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { OpportunityCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_components/opportunity-create-form";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteCreateOpportunityPageProps extends PageProps<"/[locale]/dashboard/website/opportunities/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteCreateOpportunityPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Create opportunity"),
	});

	return metadata;
}

export default async function DashboardWebsiteCreateOpportunityPage(
	_props: Readonly<DashboardWebsiteCreateOpportunityPageProps>,
): Promise<ReactNode> {
	const sources = await db.query.opportunitySources.findMany({
		orderBy: {
			source: "asc",
		},
		columns: {
			id: true,
			source: true,
		},
	});

	return <OpportunityCreateForm sources={sources} />;
}
