import type { Metadata } from "next";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { UnauthorizedState } from "@/app/_components/unauthorized-state";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = {
		title: t("Sign in required"),
		/**
		 * Automatically set by next.js.
		 *
		 * @see {@link https://nextjs.org/docs/app/api-reference/functions/unauthorized}
		 */
		// robots: {
		// 	index: false,
		// },
	};

	return metadata;
}

export default function UnauthorizedPage(): ReactNode {
	const t = useExtracted();

	return (
		<UnauthorizedState
			codeLabel={t("Error 401")}
			description={t(
				"You need to sign in to access this page. If you already have an account, please sign in below.",
			)}
			homeHref="/"
			homeLabel={t("Back to home")}
			logoLabel={t("Home")}
			signInHref="/auth/sign-in"
			signInLabel={t("Sign in")}
			title={t("Sign in required")}
		/>
	);
}
