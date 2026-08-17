import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Link } from "@dariah-eric/ui/link";
import { Text } from "@dariah-eric/ui/text";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { ResetPasswordForm } from "@/app/(app)/[locale]/(auth)/auth/reset-password/_components/reset-password-form";
import { Main } from "@/components/main";
import { auth } from "@/lib/auth";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

interface ResetPasswordPageProps extends PageProps<"/[locale]/auth/reset-password"> {}

export async function generateMetadata(
	_props: Readonly<ResetPasswordPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Reset password"),
	});

	return metadata;
}

export default async function ResetPasswordPage(
	_props: Readonly<ResetPasswordPageProps>,
): Promise<ReactNode> {
	const locale = await getLocale();

	const t = await getExtracted();

	if (!(await globalGetRequestRateLimit())) {
		return t("Too many requests.");
	}

	const { session, user } = await auth.validatePasswordResetSessionFromRequest();

	if (session == null) {
		redirect({ href: "/auth/forgot-password", locale });
	}

	if (!session.isEmailVerified) {
		redirect({ href: "/auth/reset-password/verify-email", locale });
	}

	if (user.isTwoFactorRegistered && !session.isTwoFactorVerified) {
		redirect({ href: "/auth/reset-password/two-factor", locale });
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
					<h1 className="text-xl/10 font-semibold">{t("Reset password")}</h1>

					<Text>{t("Please provide a new password for your account.")}</Text>
				</div>

				<ResetPasswordForm />
			</div>
		</Main>
	);
}
