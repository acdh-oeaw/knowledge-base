ALTER TABLE "project_calls" DROP CONSTRAINT "project_calls_call_enum_check", ADD CONSTRAINT "project_calls_call_enum_check" CHECK ("call" in ('clariah_at_project_funding_2022', 'clariah_at_project_funding_2024', 'clariah_at_project_funding_2025', 'clariah_at_project_funding_2026', 'go_digital_1_0', 'go_digital_2_0', 'go_digital_3_0', 'go_digital_next_generation', 'dh_long_term_projects_cultural_heritage', 'other'));

INSERT INTO "project_calls" ("call")
VALUES
	('dh_long_term_projects_cultural_heritage'),
	('other')
ON CONFLICT DO NOTHING;
