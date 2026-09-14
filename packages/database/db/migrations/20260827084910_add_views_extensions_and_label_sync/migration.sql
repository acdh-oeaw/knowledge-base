-- Everything drizzle-kit's schema diff cannot produce on its own: extensions, the 5 `.existing()`
-- views declared in schema.ts, and the label/locale-shared-field sync triggers. Reconstructed from
-- the fuller (pre-squash) migration history, with every dariah-eu / entity lookup rewritten to join
-- the current `slugs` table instead of the removed `entities.slug` column. No backfill statements:
-- this runs against a freshly built (empty) database.

CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- Per-document lifecycle snapshot, scoped to the default locale (a document's identity for
-- draft/published purposes is its default-locale version).
CREATE VIEW "document_lifecycle" AS
SELECT
	"entities"."id"                    AS "document_id",
	"entities"."type_id",
	"draft_versions"."id"              AS "draft_id",
	"draft_versions"."updated_at"      AS "draft_updated_at",
	"published_versions"."id"          AS "published_id",
	"published_versions"."updated_at"  AS "published_updated_at",
	(
		"draft_versions"."id" IS NOT NULL
		AND (
			"published_versions"."id" IS NULL
			OR "draft_versions"."updated_at" > "published_versions"."updated_at"
		)
	) AS "has_draft_changes",
	CASE
		WHEN "draft_versions"."id" IS NOT NULL
			AND "published_versions"."id" IS NOT NULL
			AND "draft_versions"."updated_at" > "published_versions"."updated_at"
		THEN 'published_with_changes'
		WHEN "published_versions"."id" IS NOT NULL
		THEN 'published'
		ELSE 'draft'
	END AS "state"
FROM
	"entities"
	LEFT JOIN "entity_versions" "draft_versions"
		ON "draft_versions"."entity_id" = "entities"."id"
		AND "draft_versions"."status_id" = (
			SELECT "id" FROM "entity_status" WHERE "type" = 'draft'
		)
		AND "draft_versions"."locale_id" = (
			SELECT "id" FROM "locales" WHERE "is_default" = true
		)
	LEFT JOIN "entity_versions" "published_versions"
		ON "published_versions"."entity_id" = "entities"."id"
		AND "published_versions"."status_id" = (
			SELECT "id" FROM "entity_status" WHERE "type" = 'published'
		)
		AND "published_versions"."locale_id" = (
			SELECT "id" FROM "locales" WHERE "is_default" = true
		)
WHERE
	"draft_versions"."id" IS NOT NULL
	OR "published_versions"."id" IS NOT NULL;
--> statement-breakpoint

-- Members (published countries related to dariah-eu with is_member_of/is_observer_of) unioned with
-- cooperating-partner countries (reached via an institution's is_cooperating_partner_of relation to
-- dariah-eu). Both branches pin the eric via the `slugs` table rather than a bare 'eric' type match,
-- so a second eric in the database never counts as membership.
CREATE VIEW members_and_partners AS
SELECT
	"units"."id",
	"units"."metadata",
	"units"."name",
	"units"."summary",
	"units"."updated_at",
	"units"."image_id",
	"units"."sshoc_marketplace_actor_id",
	"unit_types"."type",
	"unit_status"."status"
FROM
	"organisational_units" "units"
	JOIN "entity_versions" "units_v" ON "units_v"."id" = "units"."id"
	JOIN "entity_status" "units_s" ON "units_s"."id" = "units_v"."status_id" AND "units_s"."type" = 'published'
	JOIN "organisational_unit_types" "unit_types" ON "units"."type_id" = "unit_types"."id" AND "unit_types"."type" = 'country'
	JOIN "organisational_units_to_units" "units_to_units" ON "units_to_units"."unit_document_id" = "units_v"."entity_id" AND "units_to_units"."duration" @> NOW()
	JOIN "organisational_unit_status" "unit_status" ON "unit_status"."id" = "units_to_units"."status" AND "unit_status"."status" IN ('is_member_of', 'is_observer_of')
	JOIN "entity_versions" "related_v" ON "related_v"."entity_id" = "units_to_units"."related_unit_document_id"
	JOIN "entity_status" "related_s" ON "related_s"."id" = "related_v"."status_id" AND "related_s"."type" = 'published'
	JOIN "organisational_units" "related_units" ON "related_units"."id" = "related_v"."id"
	JOIN "organisational_unit_types" "related_unit_types" ON "related_units"."type_id" = "related_unit_types"."id" AND "related_unit_types"."type" = 'eric'
	JOIN "slugs" "eric_slugs" ON "eric_slugs"."entity_id" = "units_to_units"."related_unit_document_id" AND "eric_slugs"."value" = 'dariah-eu' AND "eric_slugs"."is_published" = true
GROUP BY
	"units"."id", "units"."metadata", "units"."name", "units"."summary", "units"."updated_at",
	"unit_types"."type", "units"."image_id", "units"."sshoc_marketplace_actor_id", "unit_status"."status"
UNION
SELECT
	"countries"."id",
	"countries"."metadata",
	"countries"."name",
	"countries"."summary",
	"countries"."updated_at",
	"countries"."image_id",
	"countries"."sshoc_marketplace_actor_id",
	"country_types"."type",
	"coop_status"."status"
FROM
	"organisational_units" "countries"
	JOIN "entity_versions" "countries_v" ON "countries_v"."id" = "countries"."id"
	JOIN "entity_status" "countries_s" ON "countries_s"."id" = "countries_v"."status_id" AND "countries_s"."type" = 'published'
	JOIN "organisational_unit_types" "country_types" ON "countries"."type_id" = "country_types"."id" AND "country_types"."type" = 'country'
	JOIN "organisational_units_to_units" "located_in" ON "located_in"."related_unit_document_id" = "countries_v"."entity_id" AND "located_in"."duration" @> NOW()
	JOIN "organisational_unit_status" "located_in_status" ON "located_in_status"."id" = "located_in"."status" AND "located_in_status"."status" = 'is_located_in'
	JOIN "entity_versions" "institutions_v" ON "institutions_v"."entity_id" = "located_in"."unit_document_id"
	JOIN "entity_status" "institutions_s" ON "institutions_s"."id" = "institutions_v"."status_id" AND "institutions_s"."type" = 'published'
	JOIN "organisational_units" "institutions" ON "institutions"."id" = "institutions_v"."id"
	JOIN "organisational_unit_types" "institution_types" ON "institutions"."type_id" = "institution_types"."id" AND "institution_types"."type" = 'institution'
	JOIN "organisational_units_to_units" "coop_rel" ON "coop_rel"."unit_document_id" = "institutions_v"."entity_id" AND "coop_rel"."duration" @> NOW()
	JOIN "organisational_unit_status" "coop_status" ON "coop_status"."id" = "coop_rel"."status" AND "coop_status"."status" = 'is_cooperating_partner_of'
	JOIN "entity_versions" "eric_v" ON "eric_v"."entity_id" = "coop_rel"."related_unit_document_id"
	JOIN "entity_status" "eric_s" ON "eric_s"."id" = "eric_v"."status_id" AND "eric_s"."type" = 'published'
	JOIN "organisational_units" "eric_units" ON "eric_units"."id" = "eric_v"."id"
	JOIN "organisational_unit_types" "eric_types" ON "eric_units"."type_id" = "eric_types"."id" AND "eric_types"."type" = 'eric'
	JOIN "slugs" "eric_slugs" ON "eric_slugs"."entity_id" = "coop_rel"."related_unit_document_id" AND "eric_slugs"."value" = 'dariah-eu' AND "eric_slugs"."is_published" = true
GROUP BY
	"countries"."id", "countries"."metadata", "countries"."name", "countries"."summary", "countries"."updated_at",
	"country_types"."type", "countries"."image_id", "countries"."sshoc_marketplace_actor_id", "coop_status"."status";
--> statement-breakpoint

CREATE VIEW working_groups AS
SELECT
	"units"."id",
	"units"."metadata",
	"units"."name",
	"units"."acronym",
	"units"."summary",
	"units"."email",
	"units"."mailing_list",
	"units"."updated_at",
	"units"."image_id",
	"units"."sshoc_marketplace_actor_id",
	"unit_types"."type",
	"unit_status"."status"
FROM
	"organisational_units" "units"
	JOIN "entity_versions" "units_v" ON "units_v"."id" = "units"."id"
	JOIN "entity_status" "units_s" ON "units_s"."id" = "units_v"."status_id" AND "units_s"."type" = 'published'
	JOIN "organisational_unit_types" "unit_types" ON "units"."type_id" = "unit_types"."id" AND "unit_types"."type" = 'working_group'
	JOIN "organisational_units_to_units" "units_to_units" ON "units_to_units"."unit_document_id" = "units_v"."entity_id"
	JOIN "organisational_unit_status" "unit_status" ON "unit_status"."id" = "units_to_units"."status"
GROUP BY
	"units"."id", "units"."metadata", "units"."name", "units"."acronym", "units"."summary", "units"."email",
	"units"."mailing_list", "units"."updated_at", "unit_types"."type", "units"."image_id",
	"units"."sshoc_marketplace_actor_id", "unit_status"."status";
--> statement-breakpoint

CREATE VIEW dariah_projects AS
SELECT DISTINCT
	"projects"."id",
	"projects"."metadata",
	"projects"."name",
	"projects"."acronym",
	"projects"."summary",
	"projects"."duration",
	"projects"."call",
	"projects"."topic",
	"projects"."funding",
	"projects"."image_id",
	"projects"."scope_id",
	"projects"."created_at",
	"projects"."updated_at"
FROM
	"projects"
	JOIN "entity_versions" "project_version" ON "project_version"."id" = "projects"."id"
	JOIN "projects_to_organisational_units" ON "projects_to_organisational_units"."project_document_id" = "project_version"."entity_id"
	JOIN "entity_versions" "unit_version" ON "unit_version"."entity_id" = "projects_to_organisational_units"."unit_document_id"
	JOIN "organisational_units" ON "organisational_units"."id" = "unit_version"."id"
	JOIN "organisational_unit_types" ON "organisational_unit_types"."id" = "organisational_units"."type_id" AND "organisational_unit_types"."type" = 'eric'
	JOIN "project_roles" ON "project_roles"."id" = "projects_to_organisational_units"."role_id" AND "project_roles"."role" IN ('coordinator', 'participant');
--> statement-breakpoint

-- Derives member/observer country counts from members_and_partners itself, so there is a single SQL
-- definition of DARIAH membership; the other three counts join `slugs` the same way.
CREATE VIEW statistics AS
SELECT
	(
		SELECT COUNT(DISTINCT "id")::integer
		FROM "members_and_partners"
		WHERE "status" = 'is_member_of'
	) AS "member_countries",
	(
		SELECT COUNT(DISTINCT uv."entity_id")::integer
		FROM "organisational_units" u
		JOIN "entity_versions" uv ON uv."id" = u."id"
		JOIN "entity_status" us ON us."id" = uv."status_id" AND us."type" = 'published'
		JOIN "organisational_unit_types" t ON u."type_id" = t."id" AND t."type" = 'institution'
		JOIN "organisational_units_to_units" r ON r."unit_document_id" = uv."entity_id" AND r."duration" @> NOW()
		JOIN "organisational_unit_status" s ON r."status" = s."id" AND s."status" IN (
			'is_partner_institution_of',
			'is_national_coordinating_institution_in'
		)
		JOIN "entity_versions" rv ON rv."entity_id" = r."related_unit_document_id"
		JOIN "entity_status" rs ON rs."id" = rv."status_id" AND rs."type" = 'published'
		JOIN "organisational_units" umb ON umb."id" = rv."id"
		JOIN "organisational_unit_types" umb_t ON umb."type_id" = umb_t."id" AND umb_t."type" = 'eric'
		JOIN "slugs" eric_slugs ON eric_slugs."entity_id" = r."related_unit_document_id" AND eric_slugs."value" = 'dariah-eu' AND eric_slugs."is_published" = true
	) AS "partner_institutions",
	(
		SELECT COUNT(DISTINCT uv."entity_id")::integer
		FROM "organisational_units" u
		JOIN "entity_versions" uv ON uv."id" = u."id"
		JOIN "entity_status" us ON us."id" = uv."status_id" AND us."type" = 'published'
		JOIN "organisational_unit_types" t ON u."type_id" = t."id" AND t."type" = 'institution'
		JOIN "organisational_units_to_units" r ON r."unit_document_id" = uv."entity_id" AND r."duration" @> NOW()
		JOIN "organisational_unit_status" s ON r."status" = s."id" AND s."status" = 'is_cooperating_partner_of'
		JOIN "entity_versions" rv ON rv."entity_id" = r."related_unit_document_id"
		JOIN "entity_status" rs ON rs."id" = rv."status_id" AND rs."type" = 'published'
		JOIN "organisational_units" umb ON umb."id" = rv."id"
		JOIN "organisational_unit_types" umb_t ON umb."type_id" = umb_t."id" AND umb_t."type" = 'eric'
		JOIN "slugs" eric_slugs ON eric_slugs."entity_id" = r."related_unit_document_id" AND eric_slugs."value" = 'dariah-eu' AND eric_slugs."is_published" = true
	) AS "cooperating_partners",
	(
		SELECT COUNT(DISTINCT uv."entity_id")::integer
		FROM "organisational_units" u
		JOIN "entity_versions" uv ON uv."id" = u."id"
		JOIN "entity_status" us ON us."id" = uv."status_id" AND us."type" = 'published'
		JOIN "organisational_unit_types" t ON u."type_id" = t."id" AND t."type" = 'working_group'
		JOIN "organisational_units_to_units" r ON r."unit_document_id" = uv."entity_id" AND r."duration" @> NOW()
		JOIN "organisational_unit_status" s ON r."status" = s."id" AND s."status" = 'is_part_of'
		JOIN "entity_versions" rv ON rv."entity_id" = r."related_unit_document_id"
		JOIN "entity_status" rs ON rs."id" = rv."status_id" AND rs."type" = 'published'
		JOIN "organisational_units" related ON related."id" = rv."id"
		JOIN "organisational_unit_types" related_t ON related."type_id" = related_t."id" AND related_t."type" = 'eric'
		JOIN "slugs" eric_slugs ON eric_slugs."entity_id" = r."related_unit_document_id" AND eric_slugs."value" = 'dariah-eu' AND eric_slugs."is_published" = true
	) AS "working_groups",
	(
		SELECT COUNT(DISTINCT "id")::integer
		FROM "members_and_partners"
		WHERE "status" = 'is_observer_of'
	) AS "observer_countries";
--> statement-breakpoint

-- Denormalized, searchable `label` (published title/name) on the `entities` document table.
--
-- The human title/name lives on the per-type version subtables (events.title, organisational_units.name,
-- ...), so searching/displaying a document by name previously meant joining ~14 tables. Instead we
-- mirror the *published* version's title/name onto entities.label, maintained by triggers so no
-- application code has to keep it in sync. Null until the document has a published version.
CREATE OR REPLACE FUNCTION "sync_entity_label_from_title"()
	RETURNS trigger AS $$
BEGIN
	UPDATE "entities" AS e
	SET "label" = NEW."title"
	FROM "entity_versions" AS ev
	JOIN "entity_status" AS es ON ev."status_id" = es."id"
	WHERE ev."id" = NEW."id"
		AND e."id" = ev."entity_id"
		AND es."type" = 'published';
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "sync_entity_label_from_name"()
	RETURNS trigger AS $$
BEGIN
	UPDATE "entities" AS e
	SET "label" = NEW."name"
	FROM "entity_versions" AS ev
	JOIN "entity_status" AS es ON ev."status_id" = es."id"
	WHERE ev."id" = NEW."id"
		AND e."id" = ev."entity_id"
		AND es."type" = 'published';
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Projects and organisational units can also have an acronym; include it in the label so relation
-- pickers can display/search it without joining the subtype tables. Persons have no acronym, so
-- they stay on the plain name-only function above.
CREATE OR REPLACE FUNCTION "sync_entity_label_from_name_and_acronym"()
	RETURNS trigger AS $$
BEGIN
	UPDATE "entities" AS e
	SET "label" = NEW."name" || CASE
		WHEN NULLIF(btrim(NEW."acronym"), '') IS NOT NULL
			THEN ' (' || btrim(NEW."acronym") || ')'
		ELSE ''
	END
	FROM "entity_versions" AS ev
	JOIN "entity_status" AS es ON ev."status_id" = es."id"
	WHERE ev."id" = NEW."id"
		AND e."id" = ev."entity_id"
		AND es."type" = 'published';
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "documentation_pages_sync_entity_label" ON "documentation_pages";
--> statement-breakpoint
CREATE TRIGGER "documentation_pages_sync_entity_label"
	AFTER INSERT OR UPDATE OF "title" ON "documentation_pages"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_title"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "documents_policies_sync_entity_label" ON "documents_policies";
--> statement-breakpoint
CREATE TRIGGER "documents_policies_sync_entity_label"
	AFTER INSERT OR UPDATE OF "title" ON "documents_policies"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_title"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "events_sync_entity_label" ON "events";
--> statement-breakpoint
CREATE TRIGGER "events_sync_entity_label"
	AFTER INSERT OR UPDATE OF "title" ON "events"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_title"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "funding_calls_sync_entity_label" ON "funding_calls";
--> statement-breakpoint
CREATE TRIGGER "funding_calls_sync_entity_label"
	AFTER INSERT OR UPDATE OF "title" ON "funding_calls"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_title"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "impact_case_studies_sync_entity_label" ON "impact_case_studies";
--> statement-breakpoint
CREATE TRIGGER "impact_case_studies_sync_entity_label"
	AFTER INSERT OR UPDATE OF "title" ON "impact_case_studies"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_title"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "internal_pages_sync_entity_label" ON "internal_pages";
--> statement-breakpoint
CREATE TRIGGER "internal_pages_sync_entity_label"
	AFTER INSERT OR UPDATE OF "title" ON "internal_pages"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_title"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "news_sync_entity_label" ON "news";
--> statement-breakpoint
CREATE TRIGGER "news_sync_entity_label"
	AFTER INSERT OR UPDATE OF "title" ON "news"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_title"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "opportunities_sync_entity_label" ON "opportunities";
--> statement-breakpoint
CREATE TRIGGER "opportunities_sync_entity_label"
	AFTER INSERT OR UPDATE OF "title" ON "opportunities"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_title"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "pages_sync_entity_label" ON "pages";
--> statement-breakpoint
CREATE TRIGGER "pages_sync_entity_label"
	AFTER INSERT OR UPDATE OF "title" ON "pages"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_title"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "spotlight_articles_sync_entity_label" ON "spotlight_articles";
--> statement-breakpoint
CREATE TRIGGER "spotlight_articles_sync_entity_label"
	AFTER INSERT OR UPDATE OF "title" ON "spotlight_articles"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_title"();
--> statement-breakpoint

DROP TRIGGER IF EXISTS "persons_sync_entity_label" ON "persons";
--> statement-breakpoint
CREATE TRIGGER "persons_sync_entity_label"
	AFTER INSERT OR UPDATE OF "name" ON "persons"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_name"();
--> statement-breakpoint

DROP TRIGGER IF EXISTS "organisational_units_sync_entity_label" ON "organisational_units";
--> statement-breakpoint
CREATE TRIGGER "organisational_units_sync_entity_label"
	AFTER INSERT OR UPDATE OF "name", "acronym" ON "organisational_units"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_name_and_acronym"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "projects_sync_entity_label" ON "projects";
--> statement-breakpoint
CREATE TRIGGER "projects_sync_entity_label"
	AFTER INSERT OR UPDATE OF "name", "acronym" ON "projects"
	FOR EACH ROW EXECUTE FUNCTION "sync_entity_label_from_name_and_acronym"();
--> statement-breakpoint

-- `projects.duration`, `.funding`, `.scope_id`, `organisational_units.acronym`, `.ror`,
-- `.sshoc_marketplace_actor_id`, `persons.email`, `.orcid`, and `events.duration`, `.location`,
-- `.is_full_day` are facts, not translatable copy, but `entity_versions` (and therefore each
-- subtype table) still has one row per locale. Each trigger keeps those columns in sync across every
-- locale version of a document: the default-locale row is the source of truth, writes to a
-- non-default-locale row are overridden to mirror it, and writes to the default-locale row are
-- propagated out to its sibling locale rows (matched by status, since draft/published are separate
-- rows). Assumes the default-locale version already exists before a translation is created; if it
-- doesn't, the ELSE branch resolves to NULL and the relevant NOT NULL constraints reject the insert.
CREATE OR REPLACE FUNCTION sync_project_shared_fields()
RETURNS TRIGGER AS $$
DECLARE
	v_entity_id uuid;
	v_status_id uuid;
	v_locale_id uuid;
	v_is_default boolean;
BEGIN
	SELECT ev.entity_id, ev.status_id, ev.locale_id
	  INTO v_entity_id, v_status_id, v_locale_id
	  FROM entity_versions ev
	 WHERE ev.id = NEW.id;

	SELECT is_default INTO v_is_default FROM locales WHERE id = v_locale_id;

	IF v_is_default THEN
		UPDATE projects p
		   SET duration = NEW.duration,
		       funding = NEW.funding,
		       scope_id = NEW.scope_id
		  FROM entity_versions ev
		 WHERE p.id = ev.id
		   AND ev.entity_id = v_entity_id
		   AND ev.status_id = v_status_id
		   AND ev.locale_id <> v_locale_id;
	ELSE
		SELECT p.duration, p.funding, p.scope_id
		  INTO NEW.duration, NEW.funding, NEW.scope_id
		  FROM projects p
		  JOIN entity_versions ev ON ev.id = p.id
		  JOIN locales l ON l.id = ev.locale_id AND l.is_default
		 WHERE ev.entity_id = v_entity_id
		   AND ev.status_id = v_status_id;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER projects_sync_shared_fields
BEFORE INSERT OR UPDATE OF duration, funding, scope_id ON projects
FOR EACH ROW
EXECUTE FUNCTION sync_project_shared_fields();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_organisational_unit_shared_fields()
RETURNS TRIGGER AS $$
DECLARE
	v_entity_id uuid;
	v_status_id uuid;
	v_locale_id uuid;
	v_is_default boolean;
BEGIN
	SELECT ev.entity_id, ev.status_id, ev.locale_id
	  INTO v_entity_id, v_status_id, v_locale_id
	  FROM entity_versions ev
	 WHERE ev.id = NEW.id;

	SELECT is_default INTO v_is_default FROM locales WHERE id = v_locale_id;

	IF v_is_default THEN
		UPDATE organisational_units u
		   SET acronym = NEW.acronym,
		       ror = NEW.ror,
		       sshoc_marketplace_actor_id = NEW.sshoc_marketplace_actor_id
		  FROM entity_versions ev
		 WHERE u.id = ev.id
		   AND ev.entity_id = v_entity_id
		   AND ev.status_id = v_status_id
		   AND ev.locale_id <> v_locale_id;
	ELSE
		SELECT u.acronym, u.ror, u.sshoc_marketplace_actor_id
		  INTO NEW.acronym, NEW.ror, NEW.sshoc_marketplace_actor_id
		  FROM organisational_units u
		  JOIN entity_versions ev ON ev.id = u.id
		  JOIN locales l ON l.id = ev.locale_id AND l.is_default
		 WHERE ev.entity_id = v_entity_id
		   AND ev.status_id = v_status_id;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER organisational_units_sync_shared_fields
BEFORE INSERT OR UPDATE OF acronym, ror, sshoc_marketplace_actor_id ON organisational_units
FOR EACH ROW
EXECUTE FUNCTION sync_organisational_unit_shared_fields();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_person_shared_fields()
RETURNS TRIGGER AS $$
DECLARE
	v_entity_id uuid;
	v_status_id uuid;
	v_locale_id uuid;
	v_is_default boolean;
BEGIN
	SELECT ev.entity_id, ev.status_id, ev.locale_id
	  INTO v_entity_id, v_status_id, v_locale_id
	  FROM entity_versions ev
	 WHERE ev.id = NEW.id;

	SELECT is_default INTO v_is_default FROM locales WHERE id = v_locale_id;

	IF v_is_default THEN
		UPDATE persons p
		   SET email = NEW.email,
		       orcid = NEW.orcid
		  FROM entity_versions ev
		 WHERE p.id = ev.id
		   AND ev.entity_id = v_entity_id
		   AND ev.status_id = v_status_id
		   AND ev.locale_id <> v_locale_id;
	ELSE
		SELECT p.email, p.orcid
		  INTO NEW.email, NEW.orcid
		  FROM persons p
		  JOIN entity_versions ev ON ev.id = p.id
		  JOIN locales l ON l.id = ev.locale_id AND l.is_default
		 WHERE ev.entity_id = v_entity_id
		   AND ev.status_id = v_status_id;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER persons_sync_shared_fields
BEFORE INSERT OR UPDATE OF email, orcid ON persons
FOR EACH ROW
EXECUTE FUNCTION sync_person_shared_fields();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_event_shared_fields()
RETURNS TRIGGER AS $$
DECLARE
	v_entity_id uuid;
	v_status_id uuid;
	v_locale_id uuid;
	v_is_default boolean;
BEGIN
	SELECT ev.entity_id, ev.status_id, ev.locale_id
	  INTO v_entity_id, v_status_id, v_locale_id
	  FROM entity_versions ev
	 WHERE ev.id = NEW.id;

	SELECT is_default INTO v_is_default FROM locales WHERE id = v_locale_id;

	IF v_is_default THEN
		UPDATE events e
		   SET duration = NEW.duration,
		       location = NEW.location,
		       is_full_day = NEW.is_full_day
		  FROM entity_versions ev
		 WHERE e.id = ev.id
		   AND ev.entity_id = v_entity_id
		   AND ev.status_id = v_status_id
		   AND ev.locale_id <> v_locale_id;
	ELSE
		SELECT e.duration, e.location, e.is_full_day
		  INTO NEW.duration, NEW.location, NEW.is_full_day
		  FROM events e
		  JOIN entity_versions ev ON ev.id = e.id
		  JOIN locales l ON l.id = ev.locale_id AND l.is_default
		 WHERE ev.entity_id = v_entity_id
		   AND ev.status_id = v_status_id;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER events_sync_shared_fields
BEFORE INSERT OR UPDATE OF duration, location, is_full_day ON events
FOR EACH ROW
EXECUTE FUNCTION sync_event_shared_fields();
--> statement-breakpoint

-- Same (person, org, role) / (unit, related unit, status) combination may recur over non-overlapping
-- periods, so uniqueness is enforced on the duration overlap rather than a plain unique constraint.
-- Drizzle has no builder for GiST exclusion constraints, so these are hand-written (requires
-- btree_gist, created above, for the `=` operator class on uuid).
ALTER TABLE "persons_to_organisational_units"
	ADD CONSTRAINT "persons_to_organisational_units_person_org_role_no_overlap"
	EXCLUDE USING gist (
		"person_document_id" WITH =,
		"organisational_unit_document_id" WITH =,
		"role_type_id" WITH =,
		"duration" WITH &&
	);
--> statement-breakpoint
ALTER TABLE "organisational_units_to_units"
	ADD CONSTRAINT "organisational_units_to_units_unit_related_status_no_overlap"
	EXCLUDE USING gist (
		"unit_document_id" WITH =,
		"related_unit_document_id" WITH =,
		"status" WITH =,
		"duration" WITH &&
	);
