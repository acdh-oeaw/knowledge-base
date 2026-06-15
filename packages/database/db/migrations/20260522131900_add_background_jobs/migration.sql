CREATE TABLE IF NOT EXISTS "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7() NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"triggered_by_user_id" uuid,
	"started_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp (3) with time zone,
	"result" jsonb,
	"error" text,
	CONSTRAINT "background_jobs_triggered_by_user_id_users_id_fk"
		FOREIGN KEY ("triggered_by_user_id")
		REFERENCES "users"("id")
		ON DELETE set null
		ON UPDATE no action,
	CONSTRAINT "background_jobs_kind_enum_check"
		CHECK ("kind" IN ('sync_resources_search_index', 'sync_website_search_index', 'ingest_sshoc_services')),
	CONSTRAINT "background_jobs_status_enum_check"
		CHECK ("status" IN ('running', 'succeeded', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "background_jobs_one_running_per_kind"
	ON "background_jobs" USING btree ("kind")
	WHERE "status" = 'running';

CREATE INDEX IF NOT EXISTS "background_jobs_kind_started_at_idx"
	ON "background_jobs" USING btree ("kind", "started_at" DESC);
