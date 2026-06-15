"use client";

import { log } from "@acdh-oeaw/lib";
import * as Sentry from "@sentry/nextjs";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect } from "react";

import { ErrorState } from "@/app/_components/error-state";

interface ErrorPageProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export function ErrorPage(props: Readonly<ErrorPageProps>): ReactNode {
	const { error, reset } = props;

	const t = useExtracted();

	useEffect(() => {
		log.error(error);
		Sentry.captureException(error);
	}, [error]);

	return (
		<ErrorState
			description={t(
				"An unexpected error interrupted this page. You can retry the request or return to the knowledge base home page.",
			)}
			homeHref="/"
			homeLabel={t("Back to home")}
			logoLabel={t("Home")}
			recoveryLabel={t("Recovery")}
			reset={reset}
			resetLabel={t("Try again")}
			statusLabel={t("System status")}
			title={t("Something went wrong")}
		/>
	);
}
