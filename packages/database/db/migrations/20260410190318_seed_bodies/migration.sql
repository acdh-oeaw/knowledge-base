-- DARIAH-EU: insert one document row, one version row, then the org-unit row
WITH
	"document" AS (
		INSERT INTO
			"entities" ("type_id", "slug")
		SELECT
			"entity_types"."id",
			'dariah-eu'
		FROM
			"entity_types"
		WHERE
			"entity_types"."type" = 'organisational_units'
		RETURNING
			"id"
	),
	"version" AS (
		INSERT INTO
			"entity_versions" ("entity_id", "status_id")
		SELECT
			"document"."id",
			"entity_status"."id"
		FROM
			"document",
			"entity_status"
		WHERE
			"entity_status"."type" = 'published'
		RETURNING
			"id"
	)
INSERT INTO
	"organisational_units" ("id", "name", "summary", "type_id")
SELECT
	"version"."id",
	'DARIAH-EU',
	'',
	"organisational_unit_types"."id"
FROM
	"version",
	"organisational_unit_types"
WHERE
	"organisational_unit_types"."type" = 'eric'
ON CONFLICT ("id") DO NOTHING;

--> statement-breakpoint
-- Governance bodies: bulk-insert documents, then their versions (joined by slug),
-- then the org-unit rows keyed to those versions
WITH
	"body_documents" AS (
		INSERT INTO
			"entities" ("type_id", "slug")
		SELECT
			"entity_types"."id",
			"tmp"."slug"
		FROM
			(
				VALUES
					('board-of-directors'),
					('dariah-coordination-office'),
					('general-assembly'),
					('joint-research-committee'),
					('national-coordinators-committee'),
					('scientific-advisory-board'),
					('senior-management-team')
			) AS "tmp" ("slug"),
			"entity_types"
		WHERE
			"entity_types"."type" = 'organisational_units'
		RETURNING
			"id",
			"slug"
	),
	"body_versions" AS (
		INSERT INTO
			"entity_versions" ("entity_id", "status_id")
		SELECT
			"body_documents"."id",
			"entity_status"."id"
		FROM
			"body_documents",
			"entity_status"
		WHERE
			"entity_status"."type" = 'published'
		RETURNING
			"id",
			"entity_id"
	),
	"body_units" AS (
		INSERT INTO
			"organisational_units" ("id", "name", "acronym", "summary", "type_id")
		SELECT
			"body_versions"."id",
			"tmp"."name",
			"tmp"."acronym",
			'',
			"organisational_unit_types"."id"
		FROM
			(
				VALUES
					('board-of-directors', 'Board of directors', 'bod'),
					('dariah-coordination-office', 'DARIAH coordination office', 'dco'),
					('general-assembly', 'General assembly', 'ga'),
					('joint-research-committee', 'Joint research committee', 'jrc'),
					('national-coordinators-committee', 'National coordinators committee', 'ncc'),
					('scientific-advisory-board', 'Scientific advisory board', 'sab'),
					('senior-management-team', 'Senior management team', 'smt')
			) AS "tmp" ("slug", "name", "acronym")
			JOIN "body_documents" ON "body_documents"."slug" = "tmp"."slug"
			JOIN "body_versions" ON "body_versions"."entity_id" = "body_documents"."id"
			CROSS JOIN "organisational_unit_types"
		WHERE
			"organisational_unit_types"."type" = 'governance_body'
		ON CONFLICT ("id") DO NOTHING
		RETURNING
			"id"
	)
-- unit↔unit relations are document-level: key both endpoints to their entity (document) ids.
INSERT INTO
	"organisational_units_to_units" (
		"unit_document_id",
		"related_unit_document_id",
		"status",
		"duration"
	)
SELECT
	"body_versions"."entity_id",
	"dariah_eu"."id",
	"organisational_unit_status"."id",
	-- @see {@link https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32014D0526}
	'[2014-08-06,)'::tstzrange
FROM
	"body_versions"
	CROSS JOIN "organisational_unit_status"
	CROSS JOIN (
		-- DARIAH-EU's entity (document) id
		SELECT
			"entities"."id"
		FROM
			"entities"
		WHERE
			"entities"."slug" = 'dariah-eu'
	) AS "dariah_eu"
WHERE
	"organisational_unit_status"."status" = 'is_part_of'
ON CONFLICT DO NOTHING;
