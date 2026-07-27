-- Custom SQL migration file, put your code below! --

-- `projects.duration`, `projects.funding`, and `projects.scope_id` are facts, not translatable
-- copy, but `entity_versions` (and therefore `projects`) still has one row per locale. This trigger
-- keeps those columns in sync across every locale version of a document: the default-locale row is
-- the source of truth, writes to a non-default-locale row are overridden to mirror it, and writes to
-- the default-locale row are propagated out to its sibling locale rows (matched by status, since
-- draft/published are separate rows). Assumes the default-locale version already exists before a
-- translation is created; if it doesn't, the ELSE branch resolves to NULL and the `duration NOT NULL`
-- / `scope_id NOT NULL` constraints will reject the insert.
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
-- `organisational_units.acronym`, `.ror`, and `.sshoc_marketplace_actor_id` are facts (identifiers,
-- not editorial copy), not translatable, but `entity_versions` (and therefore
-- `organisational_units`) still has one row per locale. Same sync strategy as
-- `sync_project_shared_fields`: the default-locale row is the source of truth. Applies to every
-- organisational unit type (countries, ERIC, institutions, working groups, governance bodies, etc.)
-- since they all share this one table and these fields don't vary by language for any of them.
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
-- `persons.email` and `persons.orcid` are facts (contact/identifier data), not translatable copy,
-- but `entity_versions` (and therefore `persons`) still has one row per locale. Same sync strategy
-- as `sync_project_shared_fields`: the default-locale row is the source of truth.
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
-- `events.duration`, `.location`, and `.is_full_day` are facts (when/where the event happens),
-- not translatable copy, but `entity_versions` (and therefore `events`) still has one row per
-- locale. Same sync strategy as `sync_project_shared_fields`: the default-locale row is the source
-- of truth.
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
