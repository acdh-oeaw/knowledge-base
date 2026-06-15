import type { Metadata, ResolvingMetadata } from "next";
import { useExtracted, useLocale } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { Main } from "@/app/(app)/[locale]/(default)/_components/main";
import { AcdhImprint } from "@/app/(app)/[locale]/(default)/imprint/_components/acdh-imprint";
import { createMetadata } from "@/lib/server/create-metadata";

interface ImprintPageProps extends PageProps<"/[locale]/imprint"> {}

export async function generateMetadata(
	_props: Readonly<ImprintPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Imprint"),
	});

	return metadata;
}

export default function ImprintPage(_props: Readonly<ImprintPageProps>): ReactNode {
	const locale = useLocale();
	const t = useExtracted();

	return (
		<Main className="container flex-1 px-8 py-12 xs:px-16">
			<section className="flex max-inline-(--breakpoint-md) flex-col gap-y-8">
				<h1 className="text-5xl font-extrabold tracking-tight text-text-strong">{t("Imprint")}</h1>
				<AcdhImprint locale={locale} />
			</section>
		</Main>
	);
}
