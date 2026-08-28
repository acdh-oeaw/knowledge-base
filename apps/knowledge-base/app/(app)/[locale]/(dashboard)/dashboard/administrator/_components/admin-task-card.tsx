"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Badge } from "@dariah-eric/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@dariah-eric/ui/card";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { SubmitButton } from "@dariah-eric/ui/submit-button";
import { useExtracted, useFormatter } from "next-intl";
import { type ReactNode, useActionState } from "react";

import { AdminTaskResult } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_components/admin-task-result";
import type { BackgroundJobError } from "@/lib/admin-tasks/background-job-error";
import { coerceBackgroundJobResult } from "@/lib/admin-tasks/background-job-result";
import type { LatestBackgroundJob } from "@/lib/admin-tasks/get-latest-background-jobs";
import type { ServerAction } from "@/lib/server/create-server-action";

/**
 * If a job has been in `running` for longer than this we treat it as stuck (the worker most likely
 * died with the process). The UI surfaces this so admins can act on it.
 */
const STUCK_RUNNING_THRESHOLD_MS = 60 * 60 * 1000;

interface AdminTaskCardProps {
	actionLabel: string;
	description: string;
	formAction: ServerAction<void>;
	latestJob: LatestBackgroundJob | null;
	title: string;
}

export function AdminTaskCard(props: Readonly<AdminTaskCardProps>): ReactNode {
	const { actionLabel, description, formAction, latestJob, title } = props;

	const t = useExtracted();
	const format = useFormatter();
	const [state, action] = useActionState(formAction, createActionStateInitial());

	const isRunning = latestJob?.status === "running";
	const isStuck =
		isRunning && Date.now() - latestJob.startedAt.getTime() > STUCK_RUNNING_THRESHOLD_MS;

	return (
		<Card className="block-full">
			<CardHeader>
				<div className="flex items-start justify-between gap-x-2">
					<CardTitle>{title}</CardTitle>
					{latestJob != null ? <JobStatusBadge job={latestJob} isStuck={isStuck} /> : null}
				</div>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="grow space-y-3">
				<FormStatus state={state} />
				{latestJob != null ? (
					<dl className="space-y-1 text-xs text-muted-fg">
						<div className="flex flex-wrap gap-x-2">
							<dt className="font-medium">{t("Started")}:</dt>
							<dd>
								{format.dateTime(latestJob.startedAt, {
									dateStyle: "short",
									timeStyle: "short",
								})}
								{latestJob.triggeredByName != null
									? ` ${t("by")} ${latestJob.triggeredByName}`
									: null}
							</dd>
						</div>
						{latestJob.finishedAt != null ? (
							<div className="flex flex-wrap gap-x-2">
								<dt className="font-medium">{t("Finished")}:</dt>
								<dd>
									{format.dateTime(latestJob.finishedAt, {
										dateStyle: "short",
										timeStyle: "short",
									})}
								</dd>
							</div>
						) : null}
						{latestJob.status === "succeeded" && latestJob.result != null ? (
							<div>
								<dt className="sr-only">{t("Result")}</dt>
								<dd className="mbs-2">
									<AdminTaskResult
										result={coerceBackgroundJobResult(latestJob.kind, latestJob.result)}
									/>
								</dd>
							</div>
						) : null}
						{latestJob.status === "failed" && latestJob.error != null ? (
							<div>
								<dt className="font-medium">{t("Error")}:</dt>
								<dd className="wrap-break-word whitespace-pre-wrap">
									<BackgroundJobErrorMessage error={latestJob.error} />
								</dd>
							</div>
						) : null}
					</dl>
				) : null}
			</CardContent>
			<CardFooter>
				<Form action={action} state={state}>
					<SubmitButton isDisabled={isRunning && !isStuck}>{actionLabel}</SubmitButton>
				</Form>
			</CardFooter>
		</Card>
	);
}

function JobStatusBadge(props: { job: LatestBackgroundJob; isStuck: boolean }): ReactNode {
	const t = useExtracted();
	const { job, isStuck } = props;

	if (job.status === "running") {
		return (
			<Badge intent={isStuck ? "warning" : "info"}>
				{isStuck ? t("Possibly stuck") : t("Running")}
			</Badge>
		);
	}
	if (job.status === "succeeded") {
		return <Badge intent="success">{t("Succeeded")}</Badge>;
	}
	return <Badge intent="danger">{t("Failed")}</Badge>;
}

function BackgroundJobErrorMessage(props: { error: BackgroundJobError }): ReactNode {
	const t = useExtracted();
	const { error } = props;

	switch (error.kind) {
		case "http": {
			const reason =
				error.statusText.length > 0
					? `${String(error.status)} ${error.statusText}`
					: String(error.status);
			return t("The server at {host} responded with an error ({reason}).", {
				host: error.host,
				reason,
			});
		}
		case "timeout": {
			return t("The request to {host} timed out.", { host: error.host });
		}
		case "network": {
			return t("Could not reach {host}. The service may be down or unreachable.", {
				host: error.host,
			});
		}
		case "parse": {
			return t("Received an unexpected response from {host} that could not be parsed.", {
				host: error.host,
			});
		}
		case "abort": {
			return t("The request to {host} was aborted.", { host: error.host });
		}
		case "stuck": {
			return t(
				"The previous run was marked as failed after exceeding its maximum runtime (the worker most likely terminated).",
			);
		}
		case "unknown": {
			return error.message;
		}
	}
}
