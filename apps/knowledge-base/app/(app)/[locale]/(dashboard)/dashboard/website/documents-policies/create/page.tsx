import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { DocumentOrPolicyCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_components/document-or-policy-create-form";
import { imageGridOptions } from "@/config/assets.config";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { db } from "@/lib/db";
import { asc } from "@/lib/db/sql";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteCreateDocumentOrPolicyPageProps extends PageProps<"/[locale]/dashboard/website/documents-policies/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteCreateDocumentOrPolicyPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Create document or policy"),
	});

	return metadata;
}

export default async function DashboardWebsiteCreateDocumentOrPolicyPage(
	_props: Readonly<DashboardWebsiteCreateDocumentOrPolicyPageProps>,
): Promise<ReactNode> {
	const [{ items: initialAssets }, groups] = await Promise.all([
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "documents" }),
		db.query.documentPolicyGroups.findMany({
			columns: { id: true, label: true },
			orderBy(t) {
				return [asc(t.position), asc(t.label)];
			},
		}),
	]);

	return <DocumentOrPolicyCreateForm groups={groups} initialAssets={initialAssets} />;
}
