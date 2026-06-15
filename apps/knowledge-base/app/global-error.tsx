"use client";

import { log } from "@acdh-oeaw/lib";
import * as Sentry from "@sentry/nextjs";
import { type ReactNode, useEffect } from "react";

import { DocumentBody } from "@/app/_components/document-body";
import { ErrorState } from "@/app/_components/error-state";
import { HtmlDocument } from "@/app/_components/html-document";
import { defaultLocale } from "@/lib/i18n/locales";

export { viewport } from "@/app/_lib/viewport.config";

/**
 * Currently, the global error page does not support metadata, because error pages in next.js must
 * be client components. We can add a document title with `<title>` though.
 *
 * Also, we cannot use i18n without importing all messages client-side.
 */

interface GlobalErrorPageProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function GlobalErrorPage(props: Readonly<GlobalErrorPageProps>): ReactNode {
	const { error, reset } = props;

	const locale = defaultLocale;

	const t = {
		meta: {
			title: "Error",
		},
		description:
			"An unexpected application error occurred. You can retry the current action or return to the home page.",
		home: "Back to home",
		logo: "Home",
		recovery: "Recovery",
		reset: "Try again",
		status: "System status",
		title: "Something went wrong",
	};

	useEffect(() => {
		log.error(error);
		Sentry.captureException(error);
	}, [error]);

	return (
		<HtmlDocument locale={locale}>
			<title>{t.meta.title}</title>
			<DocumentBody>
				<ErrorState
					description={t.description}
					homeHref="/"
					homeLabel={t.home}
					logoLabel={t.logo}
					recoveryLabel={t.recovery}
					reset={reset}
					resetLabel={t.reset}
					statusLabel={t.status}
					title={t.title}
				/>
			</DocumentBody>
		</HtmlDocument>
	);
}
