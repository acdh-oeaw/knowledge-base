-- `projects_sync_shared_fields` (added in 20260827084910_add_views_extensions_and_label_sync) keeps
-- the non-translatable "fact" columns (duration, funding, scope_id) in lockstep across a document's
-- locale versions. This revision does two things beyond the original:
--
-- 1. Adds `call_id`, added after the trigger was first written and never included, so a locale
--    version whose row predates a `call_id` edit on the default locale never picked up the change.
--
-- 2. Closes a gap where publishing the default locale only propagated to *published*-status siblings
--    across locales, never to an in-progress *draft* sibling — leaving a draft stale relative to
--    newly-published facts until someone happened to re-touch it. Publishing the default locale now
--    also pushes into draft-status siblings: safe in that direction only, since a non-default-locale
--    row's fact fields are never independently editable in the UI (always derived, never a meaningful
--    edit of their own) — there is no unpublished/WIP content to leak by writing into a draft this way.
--    The reverse (an unpublished default-locale *draft* edit reaching another locale's *published*
--    row) remains blocked, since that would leak unpublished content live.
--
-- The pull side (a non-default-locale row) now also resolves to the default locale's *published*
-- value when one exists, falling back to its draft only when nothing is published yet — rather than
-- being tied to matching the row's own status. This avoids the mirrored risk: if it preferred an
-- in-progress default-locale draft, a translator publishing a different locale's draft first could
-- leak that unpublished value live before the default locale itself is ever published with it.

CREATE OR REPLACE FUNCTION sync_project_shared_fields()
RETURNS TRIGGER AS $$
DECLARE
	v_entity_id uuid;
	v_status_id uuid;
	v_locale_id uuid;
	v_is_default boolean;
	v_published_status_id uuid;
	v_draft_status_id uuid;
BEGIN
	-- A nested invocation caused by the push UPDATEs below (depth > 1): the caller already set
	-- NEW.* explicitly to the value being pushed — trust it rather than re-deriving/overriding it.
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
		-- Push to every other-locale sibling sharing this row's own status (draft-family together,
		-- published-family together).
		UPDATE projects p
		   SET duration = NEW.duration,
		       funding = NEW.funding,
		       scope_id = NEW.scope_id,
		       call_id = NEW.call_id
		  FROM entity_versions ev
		 WHERE p.id = ev.id
		   AND ev.entity_id = v_entity_id
		   AND ev.status_id = v_status_id
		   AND ev.locale_id <> v_locale_id;

		-- Publishing the default locale makes these values canonical/live: also catch up any
		-- draft-status siblings across other locales (see comment above for why this is safe).
		IF v_status_id = v_published_status_id THEN
			UPDATE projects p
			   SET duration = NEW.duration,
			       funding = NEW.funding,
			       scope_id = NEW.scope_id,
			       call_id = NEW.call_id
			  FROM entity_versions ev
			 WHERE p.id = ev.id
			   AND ev.entity_id = v_entity_id
			   AND ev.status_id = v_draft_status_id
			   AND ev.locale_id <> v_locale_id;
		END IF;
	ELSE
		-- Prefer the default locale's published value; fall back to its draft only when nothing is
		-- published yet.
		SELECT p.duration, p.funding, p.scope_id, p.call_id
		  INTO NEW.duration, NEW.funding, NEW.scope_id, NEW.call_id
		  FROM projects p
		  JOIN entity_versions ev ON ev.id = p.id
		  JOIN locales l ON l.id = ev.locale_id AND l.is_default
		 WHERE ev.entity_id = v_entity_id
		   AND ev.status_id = v_published_status_id;

		IF NOT FOUND THEN
			SELECT p.duration, p.funding, p.scope_id, p.call_id
			  INTO NEW.duration, NEW.funding, NEW.scope_id, NEW.call_id
			  FROM projects p
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

DROP TRIGGER "projects_sync_shared_fields" ON "projects";
--> statement-breakpoint

CREATE TRIGGER projects_sync_shared_fields
BEFORE INSERT OR UPDATE OF duration, funding, scope_id, call_id ON projects
FOR EACH ROW
EXECUTE FUNCTION sync_project_shared_fields();
