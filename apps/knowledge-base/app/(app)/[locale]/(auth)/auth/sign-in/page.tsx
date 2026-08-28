import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Link } from "@dariah-eric/ui/link";
import { Text, TextLink } from "@dariah-eric/ui/text";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { SignInForm } from "@/app/(app)/[locale]/(auth)/auth/sign-in/_components/sign-in-form";
import { Main } from "@/components/main";
import { env } from "@/config/env.config";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

interface SignInPageProps extends PageProps<"/[locale]/auth/sign-in"> {}

export async function generateMetadata(
	_props: Readonly<SignInPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Sign in"),
	});

	return metadata;
}

export default async function SignInPage(_props: Readonly<SignInPageProps>): Promise<ReactNode> {
	const locale = await getLocale();
	const t = await getExtracted();

	if (!(await globalGetRequestRateLimit())) {
		return t("Too many requests.");
	}

	const { realUser: user, session } = await getCurrentSession();

	if (session != null) {
		if (!user.isEmailVerified) {
			redirect({ href: "/auth/verify-email", locale });
		}

		if (!user.isTwoFactorRegistered) {
			redirect({ href: "/auth/two-factor/setup", locale });
		}

		if (!session.isTwoFactorVerified) {
			redirect({ href: "/auth/two-factor", locale });
		}

		redirect({ href: "/dashboard", locale });
	}

	return (
		<Main className="flex flex-col items-center justify-center p-6 min-block-full">
			<div className="flex flex-col gap-y-4 inline-full max-inline-sm">
				<Link aria-label={t("Home")} className="mbe-2 inline-block self-start rounded-xs" href="/">
					<Avatar
						className="dark:invert"
						isSquare={true}
						size="md"
						src="/assets/images/logo-dariah.svg"
					/>
				</Link>

				<div>
					<h1 className="text-xl/10 font-semibold">{t("Sign in")}</h1>

					<Text>{t("Sign in to the DARIAH Knowledge Base with your user account.")}</Text>
				</div>

				<SignInForm />

				<Text className="flex flex-wrap items-center gap-x-6">
					{env.AUTH_SIGN_UP === "enabled" ? (
						<TextLink href="/auth/sign-up">{t("Create an account")}</TextLink>
					) : null}
					<TextLink href="/auth/forgot-password">{t("Forgot password?")}</TextLink>
				</Text>
			</div>
		</Main>
	);
}
