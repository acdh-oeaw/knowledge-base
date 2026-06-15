import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WorkingGroupReportEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-group-reports/_components/working-group-report-edit-form";
import { assertAuthenticated } from "@/lib/auth/session";
import { getWorkingGroupReportForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditWorkingGroupReportPageProps extends PageProps<"/[locale]/dashboard/administrator/working-group-reports/[id]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditWorkingGroupReportPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit working group report"),
	});

	return metadata;
}

export default async function DashboardAdministratorEditWorkingGroupReportPage(
	props: Readonly<DashboardAdministratorEditWorkingGroupReportPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const report = await getWorkingGroupReportForAdmin(user, id);

	if (report == null) {
		notFound();
	}

	return <WorkingGroupReportEditForm report={report} />;
}
