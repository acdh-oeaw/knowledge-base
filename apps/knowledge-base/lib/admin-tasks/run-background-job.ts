import { log } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { after } from "next/server";

import { db } from "@/lib/db";
import { and, eq, lt, sql } from "@/lib/db/sql";

export type BackgroundJobKind = schema.BackgroundJobKind;

/**
 * A `running` job older than this is treated as stuck — its worker most likely died with the Node
 * process (deploy, OOM). The next trigger sweeps such rows to `failed` so the next sync can start.
 * Must match the UI threshold in `admin-task-card.tsx`.
 */
const STUCK_AFTER_MS = 60 * 60 * 1000;

export interface RunBackgroundJobParams<T> {
	kind: BackgroundJobKind;
	triggeredByUserId: string | null;
	run: () => Promise<T>;
}

export type RunBackgroundJobOutcome =
	| { status: "started"; jobId: string }
	| { status: "already_running" };

/**
 * Insert a `background_jobs` row in `running` status and schedule the work to run via `after()`
 * once the response has been flushed to the client. On completion the same row is updated to
 * `succeeded` or `failed`. Concurrent triggers for the same `kind` collide on a partial unique
 * index and short-circuit with `{ status: "already_running" }` — no work is started.
 */
export async function runBackgroundJob<T>(
	params: RunBackgroundJobParams<T>,
): Promise<RunBackgroundJobOutcome> {
	// Self-heal stuck rows for this kind so the partial unique index frees up. A stuck row
	// almost always means the previous Node process died mid-sync (deploy, crash) and the
	// after()-callback never got to write the completion.
	await db
		.update(schema.backgroundJobs)
		.set({
			status: "failed",
			finishedAt: new Date(),
			error: "Marked as failed: exceeded stuck threshold (worker likely terminated).",
		})
		.where(
			and(
				eq(schema.backgroundJobs.kind, params.kind),
				eq(schema.backgroundJobs.status, "running"),
				lt(
					schema.backgroundJobs.startedAt,
					sql`NOW() - INTERVAL '${sql.raw(String(STUCK_AFTER_MS))} milliseconds'`,
				),
			),
		);

	const inserted = await db
		.insert(schema.backgroundJobs)
		.values({
			kind: params.kind,
			status: "running",
			triggeredByUserId: params.triggeredByUserId,
		})
		.onConflictDoNothing()
		.returning({ id: schema.backgroundJobs.id });

	const jobId = inserted[0]?.id;
	if (jobId == null) {
		return { status: "already_running" };
	}

	after(async () => {
		try {
			const result = await params.run();
			await db
				.update(schema.backgroundJobs)
				.set({
					status: "succeeded",
					finishedAt: new Date(),
					result: result as Record<string, unknown>,
				})
				.where(eq(schema.backgroundJobs.id, jobId));
		} catch (error) {
			log.error(`Background job ${params.kind} (${jobId}) failed.`, error);
			await db
				.update(schema.backgroundJobs)
				.set({
					status: "failed",
					finishedAt: new Date(),
					error:
						// oxlint-disable-next-line unicorn/no-instanceof-builtins
						error instanceof Error
							? (error.stack ?? error.message)
							: typeof error === "string"
								? error
								: JSON.stringify(error),
				})
				.where(eq(schema.backgroundJobs.id, jobId));
		}
	});

	return { status: "started", jobId };
}
