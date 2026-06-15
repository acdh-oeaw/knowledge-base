import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";

import { InternalPageView, getPublishedInternalPage } from "@/lib/data/internal-page";
import { createMetadata } from "@/lib/server/create-metadata";

interface PrivacyPolicyPageProps extends PageProps<"/[locale]/privacy-policy"> {}

export async function generateMetadata(
	_props: Readonly<PrivacyPolicyPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const page = await getPublishedInternalPage("privacy-policy");

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: page.title,
	});

	return metadata;
}

export default function PrivacyPolicyPage(_props: Readonly<PrivacyPolicyPageProps>): ReactNode {
	return <InternalPageView slug="privacy-policy" />;
}
