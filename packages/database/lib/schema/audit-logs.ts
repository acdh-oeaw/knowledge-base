import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { users } from "./users";

export const auditLogActionEnum = [
	"create",
	"update",
	"delete",
	"publish",
	"discard_draft",
	"launch",
	"close",
	"sync",
	"ingest",
	"relation_create",
	"relation_end",
] as const;

export const auditLogs = p.snakeCase.table(
	"audit_logs",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		actorUserId: p.uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
		action: p.text("action", { enum: auditLogActionEnum }).notNull(),
		subjectType: p.text("subject_type").notNull(),
		subjectId: p.text("subject_id").notNull(),
		summary: p.jsonb("summary").notNull().default({}),
		createdAt: f.timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [
		p.check("audit_logs_action_enum_check", inArray(t.action, auditLogActionEnum)),
		p.index("audit_logs_created_at_idx").on(t.createdAt),
		p.index("audit_logs_subject_idx").on(t.subjectType, t.subjectId),
		p.index("audit_logs_actor_user_id_idx").on(t.actorUserId),
	],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type AuditLogInput = typeof auditLogs.$inferInsert;

export const AuditLogSelectSchema = createSelectSchema(auditLogs);
export const AuditLogInsertSchema = createInsertSchema(auditLogs);
export const AuditLogUpdateSchema = createUpdateSchema(auditLogs);
