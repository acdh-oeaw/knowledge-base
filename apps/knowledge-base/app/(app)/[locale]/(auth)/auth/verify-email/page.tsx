import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Link } from "@dariah-eric/ui/link";
import { Text, TextLink } from "@dariah-eric/ui/text";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { EmailVerificationForm } from "@/app/(app)/[locale]/(auth)/auth/verify-email/_components/email-verification-form";
import { ResendEmailVerificationCodeForm } from "@/app/(app)/[locale]/(auth)/auth/verify-email/_components/resend-email-verification-code-form";
import { Main } from "@/components/main";
import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

interface VerifyEmailPageProps extends PageProps<"/[locale]/auth/verify-email"> {}

export async function generateMetadata(
	_props: Readonly<VerifyEmailPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Verify email address"),
	});

	return metadata;
}

export default async function VerifyEmailPage(
	_props: Readonly<VerifyEmailPageProps>,
): Promise<ReactNode> {
	const locale = await getLocale();
	const t = await getExtracted();

	if (!(await globalGetRequestRateLimit())) {
		return t("Too many requests.");
	}

	const { user } = await getCurrentSession();

	if (user == null) {
		redirect({ href: "/auth/sign-in", locale });
	}

	/**
	 * Ideally we'd send a new verification email automatically if the previous one is expired, but we
	 * can't set cookies inside server components.
	 */
	const emailVerificationRequest = await auth.getEmailVerificationRequestFromRequest();

	if (emailVerificationRequest == null && user.isEmailVerified) {
		redirect({ href: "/dashboard", locale });
	}

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
					<h1 className="text-xl/10 font-semibold">{t("Verify email address")}</h1>

					<Text>
						{t("We sent an 8-digit verification code to {email}.", {
							email: emailVerificationRequest?.email ?? user.email,
						})}
					</Text>
				</div>

				<EmailVerificationForm />

				<ResendEmailVerificationCodeForm />

				<Text className="mbs-4">
					<TextLink href="/auth/settings">{t("Change email address")}</TextLink>
				</Text>
			</div>
		</Main>
	);
}
