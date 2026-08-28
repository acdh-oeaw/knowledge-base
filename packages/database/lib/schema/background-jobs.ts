import { inArray, sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { users } from "./users";

export const backgroundJobKindEnum = [
	"sync_resources_search_index",
	"sync_website_search_index",
	"ingest_sshoc_services",
] as const;

export const backgroundJobStatusEnum = ["running", "succeeded", "failed"] as const;

export const backgroundJobs = p.snakeCase.table(
	"background_jobs",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		kind: p.text("kind", { enum: backgroundJobKindEnum }).notNull(),
		status: p.text("status", { enum: backgroundJobStatusEnum }).notNull(),
		triggeredByUserId: p
			.uuid("triggered_by_user_id")
			.references(() => users.id, { onDelete: "set null" }),
		startedAt: f.timestamp("started_at").notNull().defaultNow(),
		finishedAt: f.timestamp("finished_at"),
		result: p.jsonb("result"),
		error: p.jsonb("error"),
	},
	(t) => [
		p.check("background_jobs_kind_enum_check", inArray(t.kind, backgroundJobKindEnum)),
		p.check("background_jobs_status_enum_check", inArray(t.status, backgroundJobStatusEnum)),
		p
			.uniqueIndex("background_jobs_one_running_per_kind")
			.on(t.kind)
			.where(sql`status = 'running'`),
		p.index("background_jobs_kind_started_at_idx").on(t.kind, t.startedAt.desc()),
	],
);

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type BackgroundJobInput = typeof backgroundJobs.$inferInsert;
export type BackgroundJobKind = (typeof backgroundJobKindEnum)[number];
export type BackgroundJobStatus = (typeof backgroundJobStatusEnum)[number];

export const BackgroundJobSelectSchema = createSelectSchema(backgroundJobs);
export const BackgroundJobInsertSchema = createInsertSchema(backgroundJobs);
export const BackgroundJobUpdateSchema = createUpdateSchema(backgroundJobs);
