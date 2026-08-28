import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { Fragment, type ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { AdminTaskCard } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_components/admin-task-card";
import { ingestSshocServicesAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/ingest-sshoc-services.action";
import { syncResourcesSearchIndexAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/sync-resources-search-index.action";
import { syncWebsiteSearchIndexAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/sync-website-search-index.action";
import { getLatestBackgroundJobs } from "@/lib/admin-tasks/get-latest-background-jobs";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorTasksPageProps extends PageProps<"/[locale]/dashboard/administrator/tasks"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorTasksPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Tasks"),
	});

	return metadata;
}

export default async function DashboardAdministratorTasksPage(
	_props: Readonly<DashboardAdministratorTasksPageProps>,
): Promise<ReactNode> {
	const t = await getExtracted();

	const latestJobs = await getLatestBackgroundJobs();

	return (
		<Fragment>
			<Header className="my-(--layout-gutter) border-bs">
				<HeaderContent>
					<HeaderTitle>{t("Admin tasks")}</HeaderTitle>
					<HeaderDescription>
						{t("Run maintenance tasks that sync search and service data with upstream systems.")}
					</HeaderDescription>
				</HeaderContent>
			</Header>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
				<AdminTaskCard
					actionLabel={t("Re-sync resources index")}
					description={t("Fetch external resources and upsert the Typesense resources collection.")}
					formAction={syncResourcesSearchIndexAction}
					latestJob={latestJobs.get("sync_resources_search_index") ?? null}
					title={t("Resources search index")}
				/>
				<AdminTaskCard
					actionLabel={t("Re-sync search index")}
					description={t(
						"Rebuild the website search index entries for all syncable published content.",
					)}
					formAction={syncWebsiteSearchIndexAction}
					latestJob={latestJobs.get("sync_website_search_index") ?? null}
					title={t("Website search index")}
				/>
				<AdminTaskCard
					actionLabel={t("Ingest SSHOC services")}
					description={t(
						"Fetch DARIAH services from the SSHOC Marketplace and upsert them into the services dataset.",
					)}
					formAction={ingestSshocServicesAction}
					latestJob={latestJobs.get("ingest_sshoc_services") ?? null}
					title={t("SSHOC Marketplace services")}
				/>
			</div>
		</Fragment>
	);
}
