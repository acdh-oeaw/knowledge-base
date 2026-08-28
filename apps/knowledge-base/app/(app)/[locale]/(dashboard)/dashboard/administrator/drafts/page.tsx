import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { DraftsList } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/drafts/_components/drafts-list";
import { assertAdminPageAccess } from "@/lib/auth/session";
import { getDraftDocuments } from "@/lib/data/draft-documents";
import { createMetadata } from "@/lib/server/create-metadata";

export async function generateMetadata(
	_props: unknown,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Drafts"),
	});
}

export default async function DashboardAdministratorDraftsPage(): Promise<ReactNode> {
	await assertAdminPageAccess();

	const drafts = await getDraftDocuments();

	return <DraftsList drafts={drafts} />;
}
