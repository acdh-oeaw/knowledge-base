INSERT INTO
	"content_blocks_types" ("type")
VALUES
	('accordion'),
	('data'),
	('embed'),
	('gallery'),
	('hero'),
	('image'),
	('rich_text')
ON CONFLICT ("type") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"content_blocks_type_data_types" ("type")
VALUES
	('events'),
	('funding_calls'),
	('impact_case_studies'),
	('news'),
	('opportunities'),
	('pages'),
	('spotlight_articles')
ON CONFLICT ("type") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"entity_status" ("type")
VALUES
	('draft'),
	('published')
ON CONFLICT ("type") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"entity_types" ("type")
VALUES
	('documentation_pages'),
	('documents_policies'),
	('events'),
	('external_links'),
	('funding_calls'),
	('impact_case_studies'),
	('news'),
	('opportunities'),
	('organisational_units'),
	('pages'),
	('persons'),
	('projects'),
	('spotlight_articles')
ON CONFLICT ("type") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"licenses" ("code", "name", "url")
VALUES
	(
		'CC0-1.0',
		'Creative Commons Zero v1.0 Universal',
		'https://creativecommons.org/publicdomain/zero/1.0/'
	),
	(
		'CC-PDM-1.0',
		'Creative Commons Public Domain Mark 1.0 Universal',
		'https://creativecommons.org/publicdomain/mark/1.0/'
	),
	(
		'CC-BY-4.0',
		'Creative Commons Attribution 4.0 International',
		'https://creativecommons.org/licenses/by/4.0/'
	),
	(
		'CC-BY-NC-4.0',
		'Creative Commons Attribution Non Commercial 4.0 International',
		'https://creativecommons.org/licenses/by-nc/4.0/'
	),
	(
		'CC-BY-NC-ND-4.0',
		'Creative Commons Attribution Non Commercial No Derivatives 4.0 International',
		'https://creativecommons.org/licenses/by-nc-nd/4.0/'
	),
	(
		'CC-BY-NC-SA-4.0',
		'Creative Commons Attribution Non Commercial Share Alike 4.0 International',
		'https://creativecommons.org/licenses/by-nc-sa/4.0/'
	),
	(
		'CC-BY-ND-4.0',
		'Creative Commons Attribution No Derivatives 4.0 International',
		'https://creativecommons.org/licenses/by-nd/4.0/'
	),
	(
		'CC-BY-SA-4.0',
		'Creative Commons Attribution Share Alike 4.0 International',
		'https://creativecommons.org/licenses/by-sa/4.0/'
	)
ON CONFLICT ("code") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"organisational_unit_types" ("type")
VALUES
	('governance_body'),
	('national_consortium'),
	('country'),
	('institution'),
	('regional_hub'),
	('eric'),
	('working_group');

--> statement-breakpoint
INSERT INTO
	"organisational_unit_status" ("status")
VALUES
	('is_located_in'),
	('is_member_of'),
	('is_national_consortium_of'),
	('is_national_coordinating_institution_in'),
	('is_national_representative_institution_in'),
	('is_observer_of'),
	('is_cooperating_partner_of'),
	('is_part_of'),
	('is_partner_institution_of');

--> statement-breakpoint
INSERT INTO
	"organisational_units_allowed_relations" (
		"unit_type_id",
		"related_unit_type_id",
		"relation_type_id"
	)
SELECT
	"unit_types"."id",
	"related_unit_types"."id",
	"relation_types"."id"
FROM
	(
		VALUES
			('governance_body', 'eric', 'is_part_of'),
			('country', 'eric', 'is_member_of'),
			('country', 'eric', 'is_observer_of'),
			('national_consortium', 'country', 'is_national_consortium_of'),
			('institution', 'country', 'is_located_in'),
			('institution', 'regional_hub', 'is_member_of'),
			('institution', 'national_consortium', 'is_member_of'),
			('institution', 'eric', 'is_partner_institution_of'),
			('institution', 'eric', 'is_cooperating_partner_of'),
			('institution', 'eric', 'is_national_coordinating_institution_in'),
			('institution', 'eric', 'is_national_representative_institution_in'),
			('working_group', 'eric', 'is_part_of')
	) AS "tmp" ("unit_type", "related_unit_type", "relation_type")
	JOIN "organisational_unit_types" "unit_types" ON "unit_types"."type" = "tmp"."unit_type"
	JOIN "organisational_unit_types" "related_unit_types" ON "related_unit_types"."type" = "tmp"."related_unit_type"
	JOIN "organisational_unit_status" "relation_types" ON "relation_types"."status" = "tmp"."relation_type";

--> statement-breakpoint
INSERT INTO
	"entity_types_fields_names" ("entity_type_id", "field_name")
SELECT
	"entity_types"."id",
	"tmp"."field_name"
FROM
	(
		VALUES
			('documentation_pages', 'content'),
			('documents_policies', 'description'),
			('events', 'content'),
			('external_links', 'description'),
			('funding_calls', 'content'),
			('impact_case_studies', 'content'),
			('news', 'content'),
			('opportunities', 'content'),
			('organisational_units', 'description'),
			('pages', 'content'),
			('persons', 'biography'),
			('projects', 'description'),
			('spotlight_articles', 'content')
	) AS "tmp" ("entity_type_name", "field_name")
	JOIN "entity_types" ON "tmp"."entity_type_name" = "entity_types"."type"
ON CONFLICT ("entity_type_id", "field_name") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"person_role_types" ("type")
VALUES
	('is_affiliated_with'),
	('is_chair_of'),
	('is_vice_chair_of'),
	('is_member_of'),
	('is_contact_for'),
	('national_coordinator'),
	('national_coordinator_deputy'),
	('national_representative'),
	('national_representative_deputy')
ON CONFLICT ("type") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"person_role_types_to_organisational_unit_types" ("role_type_id", "unit_type_id")
SELECT
	"role_types"."id",
	"unit_types"."id"
FROM
	(
		VALUES
			('is_affiliated_with', 'institution'),
			('is_chair_of', 'governance_body'),
			('is_chair_of', 'working_group'),
			('is_vice_chair_of', 'governance_body'),
			('is_member_of', 'governance_body'),
			('is_member_of', 'working_group'),
			('is_member_of', 'institution'),
			('is_contact_for', 'governance_body'),
			('is_contact_for', 'working_group'),
			('is_contact_for', 'institution'),
			('is_contact_for', 'national_consortium'),
			('is_contact_for', 'eric'),
			('is_contact_for', 'country'),
			('is_contact_for', 'regional_hub'),
			('national_coordinator', 'country'),
			('national_coordinator_deputy', 'country'),
			('national_representative', 'country'),
			('national_representative_deputy', 'country')
	) AS "tmp" ("role_type", "unit_type")
	JOIN "person_role_types" "role_types" ON "role_types"."type" = "tmp"."role_type"
	JOIN "organisational_unit_types" "unit_types" ON "unit_types"."type" = "tmp"."unit_type"
ON CONFLICT ("role_type_id", "unit_type_id") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"opportunity_sources" ("source")
VALUES
	('dariah'),
	('external');

--> statement-breakpoint
INSERT INTO
	"project_scopes" ("scope")
VALUES
	('eu'),
	('national'),
	('regional');

--> statement-breakpoint
INSERT INTO
	"project_roles" ("role")
VALUES
	('coordinator'),
	('funder'),
	('participant');

--> statement-breakpoint
INSERT INTO
	"social_media_types" ("type")
VALUES
	('bluesky'),
	('facebook'),
	('instagram'),
	('linkedin'),
	('mastodon'),
	('twitter'),
	('vimeo'),
	('website'),
	('youtube'),
	('other');

--> statement-breakpoint
INSERT INTO
	"service_types" ("type")
VALUES
	('community'),
	('core'),
	('internal')
ON CONFLICT ("type") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"service_statuses" ("status")
VALUES
	('discontinued'),
	('live'),
	('needs_review'),
	('to_be_discontinued')
ON CONFLICT ("status") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"organisational_unit_service_roles" ("role")
VALUES
	('service_owner'),
	('service_provider')
ON CONFLICT ("role") DO NOTHING;
