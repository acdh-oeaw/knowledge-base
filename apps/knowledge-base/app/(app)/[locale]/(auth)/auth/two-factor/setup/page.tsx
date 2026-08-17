import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Link } from "@dariah-eric/ui/link";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { renderSVG } from "uqr";

import { TwoFactorSetUpForm } from "@/app/(app)/[locale]/(auth)/auth/two-factor/setup/_components/two-factor-set-up-form";
import { Main } from "@/components/main";
import { issuer } from "@/config/auth.config";
import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

interface TwoFactorSetupPageProps extends PageProps<"/[locale]/auth/two-factor/setup"> {}

export async function generateMetadata(
	_props: Readonly<TwoFactorSetupPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Two-factor authentication setup"),
	});

	return metadata;
}

export default async function TwoFactorSetupPage(
	_props: Readonly<TwoFactorSetupPageProps>,
): Promise<ReactNode> {
	const locale = await getLocale();

	const t = await getExtracted();

	if (!(await globalGetRequestRateLimit())) {
		return t("Too many requests.");
	}

	const { session, user } = await getCurrentSession();

	if (session == null) {
		redirect({ href: "/auth/sign-in", locale });
	}

	if (!user.isEmailVerified) {
		redirect({ href: "/auth/verify-email", locale });
	}

	if (user.isTwoFactorRegistered && !session.isTwoFactorVerified) {
		redirect({ href: "/auth/two-factor", locale });
	}

	const { key, uri } = auth.createTotpKeyUri(issuer, user.name);
	const qrcode = renderSVG(uri);

	return (
		<Main className="min-block-full p-6 items-center justify-center flex flex-col">
			<div className="inline-full max-inline-sm flex flex-col gap-y-4">
				<Link aria-label={t("Home")} className="mbe-2 rounded-xs self-start inline-block" href="/">
					<Avatar
						className="dark:invert"
						isSquare={true}
						size="md"
						src="/assets/images/logo-dariah.svg"
					/>
				</Link>

				<div>
					<h1 className="text-xl/10 font-semibold">{t("Set up two-factor authentication")}</h1>
				</div>

				<div className="flex flex-col gap-y-4">
					<div className="block-48 inline-48" dangerouslySetInnerHTML={{ __html: qrcode }} />

					<TwoFactorSetUpForm encodedTotpKey={key} />
				</div>
			</div>
		</Main>
	);
}
