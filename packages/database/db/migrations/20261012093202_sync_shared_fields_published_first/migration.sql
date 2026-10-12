-- The shared-field sync triggers keep non-translatable columns in lockstep across a document's
-- locale versions: `events_sync_shared_fields` (duration, location, is_full_day),
-- `persons_sync_shared_fields` (email, orcid) and `organisational_units_sync_shared_fields`
-- (acronym, ror, sshoc_marketplace_actor_id), all added in
-- 20260827084910_add_views_extensions_and_label_sync. This gives them the fix the projects trigger
-- already got in 20260915160000_sync_project_call_id:
--
-- 1. A non-default-locale row pulled only from a default-locale row with the *same* status. Saving a
--    translation's draft while the default locale has only a published version found nothing, and
--    `SELECT ... INTO NEW.*` with no row nulls the targets: for events that fails the save on
--    `location`'s NOT NULL constraint, for persons and units it silently blanked the columns. The
--    pull now prefers the default locale's published value and falls back to its draft.
--
-- 2. The push UPDATE fires the trigger again on each sibling row, whose pull read the default
--    locale's row *before* the outer write landed and overwrote the pushed value with the stale one.
--    Nested invocations now trust the pushed value.
--
-- 3. Publishing the default locale only reached published-status siblings, leaving translation
--    drafts stale. It now also pushes into draft-status siblings (safe in that direction: a
--    translation's shared fields are never independently editable, so there is no unpublished work
--    to clobber).

CREATE OR REPLACE FUNCTION sync_event_shared_fields()
RETURNS TRIGGER AS $$
DECLARE
	v_entity_id uuid;
	v_status_id uuid;
	v_locale_id uuid;
	v_is_default boolean;
	v_published_status_id uuid;
	v_draft_status_id uuid;
BEGIN
	IF pg_trigger_depth() > 1 THEN
		RETURN NEW;
	END IF;

	SELECT ev.entity_id, ev.status_id, ev.locale_id
	  INTO v_entity_id, v_status_id, v_locale_id
	  FROM entity_versions ev
	 WHERE ev.id = NEW.id;

	SELECT is_default INTO v_is_default FROM locales WHERE id = v_locale_id;

	SELECT id INTO v_published_status_id FROM entity_status WHERE type = 'published';
	SELECT id INTO v_draft_status_id FROM entity_status WHERE type = 'draft';

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

		IF v_status_id = v_published_status_id THEN
			UPDATE events e
			   SET duration = NEW.duration,
			       location = NEW.location,
			       is_full_day = NEW.is_full_day
			  FROM entity_versions ev
			 WHERE e.id = ev.id
			   AND ev.entity_id = v_entity_id
			   AND ev.status_id = v_draft_status_id
			   AND ev.locale_id <> v_locale_id;
		END IF;
	ELSE
		SELECT e.duration, e.location, e.is_full_day
		  INTO NEW.duration, NEW.location, NEW.is_full_day
		  FROM events e
		  JOIN entity_versions ev ON ev.id = e.id
		  JOIN locales l ON l.id = ev.locale_id AND l.is_default
		 WHERE ev.entity_id = v_entity_id
		   AND ev.status_id = v_published_status_id;

		IF NOT FOUND THEN
			SELECT e.duration, e.location, e.is_full_day
			  INTO NEW.duration, NEW.location, NEW.is_full_day
			  FROM events e
			  JOIN entity_versions ev ON ev.id = e.id
			  JOIN locales l ON l.id = ev.locale_id AND l.is_default
			 WHERE ev.entity_id = v_entity_id
			   AND ev.status_id = v_draft_status_id;
		END IF;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sync_person_shared_fields()
RETURNS TRIGGER AS $$
DECLARE
	v_entity_id uuid;
	v_status_id uuid;
	v_locale_id uuid;
	v_is_default boolean;
	v_published_status_id uuid;
	v_draft_status_id uuid;
BEGIN
	IF pg_trigger_depth() > 1 THEN
		RETURN NEW;
	END IF;

	SELECT ev.entity_id, ev.status_id, ev.locale_id
	  INTO v_entity_id, v_status_id, v_locale_id
	  FROM entity_versions ev
	 WHERE ev.id = NEW.id;

	SELECT is_default INTO v_is_default FROM locales WHERE id = v_locale_id;

	SELECT id INTO v_published_status_id FROM entity_status WHERE type = 'published';
	SELECT id INTO v_draft_status_id FROM entity_status WHERE type = 'draft';

	IF v_is_default THEN
		UPDATE persons p
		   SET email = NEW.email,
		       orcid = NEW.orcid
		  FROM entity_versions ev
		 WHERE p.id = ev.id
		   AND ev.entity_id = v_entity_id
		   AND ev.status_id = v_status_id
		   AND ev.locale_id <> v_locale_id;

		IF v_status_id = v_published_status_id THEN
			UPDATE persons p
			   SET email = NEW.email,
			       orcid = NEW.orcid
			  FROM entity_versions ev
			 WHERE p.id = ev.id
			   AND ev.entity_id = v_entity_id
			   AND ev.status_id = v_draft_status_id
			   AND ev.locale_id <> v_locale_id;
		END IF;
	ELSE
		SELECT p.email, p.orcid
		  INTO NEW.email, NEW.orcid
		  FROM persons p
		  JOIN entity_versions ev ON ev.id = p.id
		  JOIN locales l ON l.id = ev.locale_id AND l.is_default
		 WHERE ev.entity_id = v_entity_id
		   AND ev.status_id = v_published_status_id;

		IF NOT FOUND THEN
			SELECT p.email, p.orcid
			  INTO NEW.email, NEW.orcid
			  FROM persons p
			  JOIN entity_versions ev ON ev.id = p.id
			  JOIN locales l ON l.id = ev.locale_id AND l.is_default
			 WHERE ev.entity_id = v_entity_id
			   AND ev.status_id = v_draft_status_id;
		END IF;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sync_organisational_unit_shared_fields()
RETURNS TRIGGER AS $$
DECLARE
	v_entity_id uuid;
	v_status_id uuid;
	v_locale_id uuid;
	v_is_default boolean;
	v_published_status_id uuid;
	v_draft_status_id uuid;
BEGIN
	IF pg_trigger_depth() > 1 THEN
		RETURN NEW;
	END IF;

	SELECT ev.entity_id, ev.status_id, ev.locale_id
	  INTO v_entity_id, v_status_id, v_locale_id
	  FROM entity_versions ev
	 WHERE ev.id = NEW.id;

	SELECT is_default INTO v_is_default FROM locales WHERE id = v_locale_id;

	SELECT id INTO v_published_status_id FROM entity_status WHERE type = 'published';
	SELECT id INTO v_draft_status_id FROM entity_status WHERE type = 'draft';

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

		IF v_status_id = v_published_status_id THEN
			UPDATE organisational_units u
			   SET acronym = NEW.acronym,
			       ror = NEW.ror,
			       sshoc_marketplace_actor_id = NEW.sshoc_marketplace_actor_id
			  FROM entity_versions ev
			 WHERE u.id = ev.id
			   AND ev.entity_id = v_entity_id
			   AND ev.status_id = v_draft_status_id
			   AND ev.locale_id <> v_locale_id;
		END IF;
	ELSE
		SELECT u.acronym, u.ror, u.sshoc_marketplace_actor_id
		  INTO NEW.acronym, NEW.ror, NEW.sshoc_marketplace_actor_id
		  FROM organisational_units u
		  JOIN entity_versions ev ON ev.id = u.id
		  JOIN locales l ON l.id = ev.locale_id AND l.is_default
		 WHERE ev.entity_id = v_entity_id
		   AND ev.status_id = v_published_status_id;

		IF NOT FOUND THEN
			SELECT u.acronym, u.ror, u.sshoc_marketplace_actor_id
			  INTO NEW.acronym, NEW.ror, NEW.sshoc_marketplace_actor_id
			  FROM organisational_units u
			  JOIN entity_versions ev ON ev.id = u.id
			  JOIN locales l ON l.id = ev.locale_id AND l.is_default
			 WHERE ev.entity_id = v_entity_id
			   AND ev.status_id = v_draft_status_id;
		END IF;
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
