import * as schema from "@dariah-eric/database/schema";

import { db } from "@/lib/db";
import { desc, eq } from "@/lib/db/sql";

export interface LatestBackgroundJob {
	id: string;
	kind: schema.BackgroundJobKind;
	status: schema.BackgroundJobStatus;
	startedAt: Date;
	finishedAt: Date | null;
	result: unknown;
	error: string | null;
	triggeredByName: string | null;
}

/**
 * Return the most recent `background_jobs` row for each known job kind. Kinds without any rows are
 * omitted from the result.
 */
export async function getLatestBackgroundJobs(): Promise<
	Map<schema.BackgroundJobKind, LatestBackgroundJob>
> {
	const rows = await db
		.selectDistinctOn([schema.backgroundJobs.kind], {
			id: schema.backgroundJobs.id,
			kind: schema.backgroundJobs.kind,
			status: schema.backgroundJobs.status,
			startedAt: schema.backgroundJobs.startedAt,
			finishedAt: schema.backgroundJobs.finishedAt,
			result: schema.backgroundJobs.result,
			error: schema.backgroundJobs.error,
			triggeredByName: schema.users.name,
		})
		.from(schema.backgroundJobs)
		.leftJoin(schema.users, eq(schema.users.id, schema.backgroundJobs.triggeredByUserId))
		.orderBy(schema.backgroundJobs.kind, desc(schema.backgroundJobs.startedAt));

	const result = new Map<schema.BackgroundJobKind, LatestBackgroundJob>();
	for (const row of rows) {
		result.set(row.kind, {
			id: row.id,
			kind: row.kind,
			status: row.status,
			startedAt: row.startedAt,
			finishedAt: row.finishedAt,
			result: row.result,
			error: row.error,
			triggeredByName: row.triggeredByName,
		});
	}
	return result;
}
