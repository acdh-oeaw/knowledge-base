import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Link } from "@dariah-eric/ui/link";
import { Text, TextLink } from "@dariah-eric/ui/text";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { Main } from "@/components/main";
import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

interface RecoveryCodePageProps extends PageProps<"/[locale]/auth/recovery-code"> {}

export async function generateMetadata(
	_props: Readonly<RecoveryCodePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Recovery code"),
	});

	return metadata;
}

export default async function RecoveryCodePage(
	_props: Readonly<RecoveryCodePageProps>,
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

	if (!user.isTwoFactorRegistered) {
		redirect({ href: "/auth/two-factor/setup", locale });
	}

	if (!session.isTwoFactorVerified) {
		redirect({ href: "/auth/two-factor", locale });
	}

	const recoveryCode = await auth.getRecoveryCode(user.id);

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
					<h1 className="text-xl/10 font-semibold">{t("Recovery code")}</h1>

					<Text>
						{t("Your recovery code is:")} <span className="text-fg">{recoveryCode}</span>.
					</Text>
					<Text>
						{t("You can use this recovery code if you lose access to your second factors.")}
					</Text>
				</div>

				<Text className="mbs-4">
					<TextLink href="/">{t("Continue")}</TextLink>
				</Text>
			</div>
		</Main>
	);
}
