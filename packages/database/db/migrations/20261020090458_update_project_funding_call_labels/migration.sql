ALTER TABLE "project_calls" DROP CONSTRAINT "project_calls_call_enum_check";--> statement-breakpoint

-- The existing call becomes the 2022 call; projects reference the row by id and keep it.
UPDATE "project_calls" SET "call" = 'clariah_at_project_funding_2022' WHERE "call" = 'clariah_at_project_funding';--> statement-breakpoint

ALTER TABLE "project_calls" ADD CONSTRAINT "project_calls_call_enum_check" CHECK ("call" in ('clariah_at_project_funding_2022', 'clariah_at_project_funding_2024', 'clariah_at_project_funding_2025', 'clariah_at_project_funding_2026', 'go_digital_1_0', 'go_digital_2_0', 'go_digital_3_0', 'go_digital_next_generation'));--> statement-breakpoint

INSERT INTO "project_calls" ("call")
VALUES
	('clariah_at_project_funding_2024'),
	('clariah_at_project_funding_2025'),
	('clariah_at_project_funding_2026')
ON CONFLICT DO NOTHING;
