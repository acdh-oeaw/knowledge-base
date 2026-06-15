import { ButtonLink } from "@acdh-knowledge-base/ui/button-link";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { Main } from "@/app/(app)/[locale]/(default)/_components/main";
import { getCurrentSession } from "@/lib/auth/session";
import { createMetadata } from "@/lib/server/create-metadata";

interface IndexPageProps extends PageProps<"/[locale]"> {}

export async function generateMetadata(
	_props: Readonly<IndexPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		/**
		 * Fall back to `title.default` from `layout.tsx`.
		 *
		 * @see {@link https://nextjs.org/docs/app/api-reference/functions/generate-metadata#title}
		 */
	});

	return metadata;
}

export default async function IndexPage(_props: Readonly<IndexPageProps>): Promise<ReactNode> {
	const t = await getExtracted();
	const { session } = await getCurrentSession();

	const cta =
		session == null
			? { href: "/auth/sign-in", label: t("Sign in") }
			: { href: "/dashboard", label: t("Go to dashboard") };

	return (
		<Main className="container flex-1 px-8 py-12 xs:px-16">
			<section className="flex min-block-full flex-col items-center justify-center gap-y-8 py-24">
				<div className="flex flex-col items-center gap-y-4">
					<h1 className="text-center text-6xl font-extrabold tracking-tight text-text-strong">
						{t("The Knowledge Base")}
					</h1>
					<p className="text-center text-2xl font-medium tracking-tight text-text-weak">
						{t("Your central hub for everything DARIAH-related.")}
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row">
					<ButtonLink className="min-inline-40" href={cta.href} size="lg">
						{cta.label}
					</ButtonLink>
					<ButtonLink className="min-inline-40" href="/documentation" intent="outline" size="lg">
						{t("Read documentation")}
					</ButtonLink>
				</div>
			</section>
		</Main>
	);
}
