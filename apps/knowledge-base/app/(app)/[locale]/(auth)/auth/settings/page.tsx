import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Link } from "@dariah-eric/ui/link";
import { Text, TextLink } from "@dariah-eric/ui/text";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { RecoveryCodeForm } from "@/app/(app)/[locale]/(auth)/auth/settings/_components/recovery-code-form";
import { UpdateEmailForm } from "@/app/(app)/[locale]/(auth)/auth/settings/_components/update-email-form";
import { UpdatePasswordForm } from "@/app/(app)/[locale]/(auth)/auth/settings/_components/update-password-form";
import { Main } from "@/components/main";
import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

interface SettingsPageProps extends PageProps<"/[locale]/auth/settings"> {}

export async function generateMetadata(
	_props: Readonly<SettingsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Settings"),
	});

	return metadata;
}

export default async function SettingsPage(
	_props: Readonly<SettingsPageProps>,
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

	if (user.isTwoFactorRegistered && !session.isTwoFactorVerified) {
		redirect({ href: "/auth/two-factor", locale });
	}

	let recoveryCode: string | null = null;
	let showRecoveryCodeForm = false;

	if (user.isTwoFactorRegistered) {
		showRecoveryCodeForm = true;

		try {
			recoveryCode = await auth.getRecoveryCode(user.id);
		} catch {
			recoveryCode = null;
		}
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
					<h1 className="text-xl/10 font-semibold">{t("Settings")}</h1>

					{/* <Text>{t("message")}</Text> */}
				</div>

				<section className="flex flex-col gap-y-4">
					<div>
						<h2 className="text-base/8 font-semibold">{t("Update email")}</h2>

						<Text>
							{t("Your email:")} <span className="text-fg">{user.email}</span>
						</Text>
					</div>

					<UpdateEmailForm />
				</section>

				<section className="flex flex-col gap-y-4">
					<div>
						<h2 className="text-base/8 font-semibold">{t("Update password")}</h2>
					</div>

					<UpdatePasswordForm />
				</section>

				{user.isTwoFactorRegistered ? (
					<section className="flex flex-col gap-y-4">
						<div>
							<h2 className="text-base/8 font-semibold">{t("Update two-factor authentication")}</h2>
						</div>

						<Text>
							<TextLink href={"/auth/two-factor/setup"}>{t("Update")}</TextLink>
						</Text>
					</section>
				) : null}

				{showRecoveryCodeForm ? (
					<section className="flex flex-col gap-y-4">
						<div>
							<h2 className="text-base/8 font-semibold">{t("Recovery code")}</h2>
						</div>

						<RecoveryCodeForm recoveryCode={recoveryCode} />
					</section>
				) : null}
			</div>
		</Main>
	);
}
