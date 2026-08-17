"use client";

import { Button } from "@dariah-eric/ui/button";
import { type ErrorInfo, unstable_catchError } from "next/error";
import type { ReactNode } from "react";

interface LiveReportResourcesErrorBoundaryProps {
	description: string;
	retryLabel: string;
	title: string;
}

function LiveReportResourcesErrorFallback(
	props: Readonly<LiveReportResourcesErrorBoundaryProps>,
	errorInfo: ErrorInfo,
): ReactNode {
	const { description, retryLabel, title } = props;

	return (
		<section className="flex flex-col gap-y-4">
			<div className="flex flex-col gap-y-1">
				<h2 className="text-sm font-semibold text-fg">{title}</h2>
				<p className="text-sm text-muted-fg">{description}</p>
			</div>
			<div>
				<Button intent="secondary" size="sm" onPress={errorInfo.unstable_retry}>
					{retryLabel}
				</Button>
			</div>
		</section>
	);
}

export const LiveReportResourcesErrorBoundary = unstable_catchError(
	LiveReportResourcesErrorFallback,
);
