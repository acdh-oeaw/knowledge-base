import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Link } from "@dariah-eric/ui/link";
import { Text, TextLink } from "@dariah-eric/ui/text";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { SignUpForm } from "@/app/(app)/[locale]/(auth)/auth/sign-up/_components/sign-up-form";
import { Main } from "@/components/main";
import { passwords } from "@/config/auth.config";
import { env } from "@/config/env.config";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

interface SignUpPageProps extends PageProps<"/[locale]/auth/sign-up"> {}

export async function generateMetadata(
	_props: Readonly<SignUpPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Sign up"),
	});

	return metadata;
}

export default async function SignUpPage(_props: Readonly<SignUpPageProps>): Promise<ReactNode> {
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

	/**
	 * Checked in `signUpAction` as well, which is what actually enforces this. Repeated here so
	 * visitors are not offered a form which can only ever be rejected on submit.
	 */
	if (env.AUTH_SIGN_UP !== "enabled") {
		redirect({ href: "/auth/sign-in", locale });
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
					<h1 className="text-xl/10 font-semibold">{t("Create an account")}</h1>

					<Text>
						{t(
							"Your password must be between {passwordMinLength,number} and {passwordMaxLength,number} characters long.",
							{
								passwordMinLength: passwords.length.min,
								passwordMaxLength: passwords.length.max,
							},
						)}
					</Text>
				</div>

				<SignUpForm />

				<Text className="mbs-4">
					{t("Already have an account?")} <TextLink href="/auth/sign-in">{t("Sign in")}</TextLink>
				</Text>
			</div>
		</Main>
	);
}
