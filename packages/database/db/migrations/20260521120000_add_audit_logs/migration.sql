CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_actor_user_id_users_id_fk"
		FOREIGN KEY ("actor_user_id")
		REFERENCES "users"("id")
		ON DELETE set null
		ON UPDATE no action,
	CONSTRAINT "audit_logs_action_enum_check"
		CHECK ("action" IN ('create', 'update', 'delete', 'publish', 'discard_draft', 'launch', 'close', 'sync', 'ingest', 'relation_create', 'relation_end'))
);

CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_subject_idx" ON "audit_logs" USING btree ("subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_user_id_idx" ON "audit_logs" USING btree ("actor_user_id");
