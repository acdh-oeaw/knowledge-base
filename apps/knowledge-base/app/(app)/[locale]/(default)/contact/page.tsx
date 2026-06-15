import type { Metadata, ResolvingMetadata } from "next";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { Main } from "@/app/(app)/[locale]/(default)/_components/main";
import { ContactForm } from "@/app/(app)/[locale]/(default)/contact/_components/contact-form";
import { createMetadata } from "@/lib/server/create-metadata";

interface ContactPageProps extends PageProps<"/[locale]/contact"> {}

export async function generateMetadata(
	_props: Readonly<ContactPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Contact"),
	});

	return metadata;
}

export default function ContactPage(_props: Readonly<ContactPageProps>): ReactNode {
	const t = useExtracted();

	return (
		<Main className="container flex-1 px-8 py-12 xs:px-16">
			<section className="flex max-inline-(--breakpoint-md) flex-col gap-y-8">
				<h1 className="text-5xl font-extrabold tracking-tight text-text-strong">{t("Contact")}</h1>
			</section>

			<section className="max-inline-(--breakpoint-md) py-6">
				<ContactForm />
			</section>
		</Main>
	);
}
