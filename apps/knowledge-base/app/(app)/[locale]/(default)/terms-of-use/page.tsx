import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";

import { InternalPageView, getPublishedInternalPage } from "@/lib/data/internal-page";
import { createMetadata } from "@/lib/server/create-metadata";

interface TermsOfUsePageProps extends PageProps<"/[locale]/terms-of-use"> {}

export async function generateMetadata(
	_props: Readonly<TermsOfUsePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const page = await getPublishedInternalPage("terms-of-use");

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: page.title,
	});

	return metadata;
}

export default function TermsOfUsePage(_props: Readonly<TermsOfUsePageProps>): ReactNode {
	return <InternalPageView slug="terms-of-use" />;
}
