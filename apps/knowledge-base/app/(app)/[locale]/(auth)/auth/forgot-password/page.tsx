import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Link } from "@dariah-eric/ui/link";
import { Text, TextLink } from "@dariah-eric/ui/text";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ForgotPasswordForm } from "@/app/(app)/[locale]/(auth)/auth/forgot-password/_components/forgot-password-form";
import { Main } from "@/components/main";
import { createMetadata } from "@/lib/server/create-metadata";

interface ForgotPasswordPageProps extends PageProps<"/[locale]/auth/forgot-password"> {}

export async function generateMetadata(
	_props: Readonly<ForgotPasswordPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Forgot password"),
	});

	return metadata;
}

export default async function ForgotPasswordPage(
	_props: Readonly<ForgotPasswordPageProps>,
): Promise<ReactNode> {
	const t = await getExtracted();

	if (!(await globalGetRequestRateLimit())) {
		return t("Too many requests.");
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
					<h1 className="text-xl/10 font-semibold">{t("Forgot your password?")}</h1>

					<Text>{t("We will send a password reset code to your email address.")}</Text>
				</div>

				<ForgotPasswordForm />

				<Text>
					<TextLink href={"/auth/sign-in"}>{t("Sign in")}</TextLink>
				</Text>
			</div>
		</Main>
	);
}
