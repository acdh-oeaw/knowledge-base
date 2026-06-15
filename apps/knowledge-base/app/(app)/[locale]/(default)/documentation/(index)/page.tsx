import { Link } from "@acdh-knowledge-base/ui/link";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { Main } from "@/app/(app)/[locale]/(default)/_components/main";
import { db } from "@/lib/db";
import { createMetadata } from "@/lib/server/create-metadata";

async function getDocumentationPages() {
	const pages = await db.query.documentationPages.findMany({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
			},
		},
		columns: {
			id: true,
			title: true,
		},
		with: {
			entityVersion: {
				columns: {},
				with: {
					entity: {
						columns: {
							slug: true,
						},
					},
				},
			},
		},
		orderBy: {
			title: "asc",
		},
	});

	return pages;
}

interface DocumentationPageProps extends PageProps<"/[locale]/documentation"> {}

export async function generateMetadata(
	_props: Readonly<DocumentationPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Documentation"),
	});

	return metadata;
}

export default async function DocumentationPage(
	_props: Readonly<DocumentationPageProps>,
): Promise<ReactNode> {
	const t = await getExtracted();

	const pages = await getDocumentationPages();

	return (
		<Main className="container flex-1 px-8 py-12 xs:px-16">
			<section className="flex flex-col gap-y-8">
				<h1 className="text-5xl font-extrabold tracking-tight text-text-strong">
					{t("Documentation")}
				</h1>
				<ul className="list-disc space-y-2 ps-6">
					{pages.map((page) => (
						<li key={page.id}>
							<Link href={`/documentation/${page.entityVersion.entity.slug}`}>{page.title}</Link>
						</li>
					))}
				</ul>
			</section>
		</Main>
	);
}
