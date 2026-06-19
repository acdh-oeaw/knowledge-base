CREATE EXTENSION IF NOT EXISTS unaccent;

--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;

--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"summary" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_action_enum_check" CHECK ("action" in ('create', 'update', 'delete', 'publish', 'discard_draft', 'launch', 'close', 'sync', 'ingest', 'relation_create', 'relation_end'))
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"key" text NOT NULL,
	"label" text NOT NULL,
	"filename" text,
	"mime_type" text NOT NULL,
	"size" bigint,
	"caption" text,
	"alt" text,
	"license_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"triggered_by_user_id" uuid,
	"started_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp(3) with time zone,
	"result" jsonb,
	"error" text,
	CONSTRAINT "background_jobs_kind_enum_check" CHECK ("kind" in ('sync_resources_search_index', 'sync_website_search_index', 'ingest_sshoc_services')),
	CONSTRAINT "background_jobs_status_enum_check" CHECK ("status" in ('running', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "content_blocks_type_accordion" (
	"id" uuid PRIMARY KEY,
	"items" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_blocks_types" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"type" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_blocks_types_type_enum_check" CHECK ("type" in ('accordion', 'data', 'embed', 'gallery', 'hero', 'image', 'rich_text'))
);
--> statement-breakpoint
CREATE TABLE "content_blocks" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"field_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_blocks_type_data_types" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"type" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_blocks_type_data_types_type_enum_check" CHECK ("type" in ('events', 'funding_calls', 'impact_case_studies', 'news', 'opportunities', 'pages', 'spotlight_articles'))
);
--> statement-breakpoint
CREATE TABLE "content_blocks_type_data" (
	"id" uuid PRIMARY KEY,
	"type_id" uuid NOT NULL,
	"limit" integer,
	"selected_ids" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_blocks_type_embed" (
	"id" uuid PRIMARY KEY,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"caption" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_blocks_type_gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"gallery_content_block_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"caption" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_blocks_type_gallery" (
	"id" uuid PRIMARY KEY,
	"layout" text DEFAULT 'grid' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_blocks_type_hero" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"eyebrow" text,
	"image_id" uuid,
	"ctas" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_blocks_type_image" (
	"id" uuid PRIMARY KEY,
	"image_id" uuid NOT NULL,
	"caption" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_blocks_type_rich_text" (
	"id" uuid PRIMARY KEY,
	"content" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_policy_groups" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"label" text NOT NULL UNIQUE,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentation_pages" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents_policies" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"summary" text,
	"url" text,
	"document_id" uuid NOT NULL,
	"group_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"type_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_type_id_slug_unique" UNIQUE("type_id","slug")
);
--> statement-breakpoint
CREATE TABLE "entities_to_entities" (
	"entity_id" uuid,
	"related_entity_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_to_entities_pkey" PRIMARY KEY("entity_id","related_entity_id")
);
--> statement-breakpoint
CREATE TABLE "entities_to_resources" (
	"entity_id" uuid,
	"resource_id" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_to_resources_pkey" PRIMARY KEY("entity_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "entity_status" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"type" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_status_type_enum_check" CHECK ("type" in ('draft', 'published'))
);
--> statement-breakpoint
CREATE TABLE "entity_types" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"type" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_types_type_enum_check" CHECK ("type" in ('documentation_pages', 'documents_policies', 'events', 'external_links', 'funding_calls', 'impact_case_studies', 'internal_pages', 'news', 'opportunities', 'organisational_units', 'pages', 'persons', 'projects', 'spotlight_articles'))
);
--> statement-breakpoint
CREATE TABLE "entity_types_fields_names" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"entity_type_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	CONSTRAINT "entity_types_fields_names_entity_type_id_field_name_unique" UNIQUE("entity_type_id","field_name")
);
--> statement-breakpoint
CREATE TABLE "entity_versions" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"entity_id" uuid NOT NULL,
	"status_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_versions_entity_id_status_id_unique" UNIQUE("entity_id","status_id")
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"entity_version_id" uuid NOT NULL,
	"field_name_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fields_entity_version_id_field_name_id_unique" UNIQUE("entity_version_id","field_name_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"image_id" uuid NOT NULL,
	"location" text NOT NULL,
	"duration" tstzrange NOT NULL,
	"is_full_day" boolean DEFAULT false NOT NULL,
	"website" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_links" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"url" text NOT NULL,
	"image_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_calls" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"summary" text,
	"duration" tstzrange NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact_case_studies" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"image_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact_case_studies_to_persons" (
	"impact_case_study_document_id" uuid,
	"person_document_id" uuid,
	"role" text DEFAULT 'author' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "impact_case_studies_to_persons_pkey" PRIMARY KEY("impact_case_study_document_id","person_document_id")
);
--> statement-breakpoint
CREATE TABLE "internal_pages" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"code" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_items" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"menu_id" uuid NOT NULL,
	"parent_id" uuid,
	"label" text NOT NULL,
	"href" text,
	"entity_id" uuid,
	"is_external" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "navigation_items_link" CHECK (
					NOT (
						"href" IS NOT NULL
						AND "entity_id" IS NOT NULL
					)
				)
);
--> statement-breakpoint
CREATE TABLE "navigation_menus" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"name" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"image_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"summary" text,
	"duration" tstzrange NOT NULL,
	"source_id" uuid NOT NULL,
	"website" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_sources" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"source" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_sources_source_enum_check" CHECK ("source" in ('dariah', 'external'))
);
--> statement-breakpoint
CREATE TABLE "organisational_unit_status" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"status" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisational_unit_status_status_enum_check" CHECK ("status" in ('is_located_in', 'is_member_of', 'is_national_consortium_of', 'is_national_coordinating_institution_in', 'is_national_representative_institution_in', 'is_observer_of', 'is_cooperating_partner_of', 'is_part_of', 'is_partner_institution_of'))
);
--> statement-breakpoint
CREATE TABLE "organisational_unit_types" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"type" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisational_unit_types_type_enum_check" CHECK ("type" in ('governance_body', 'national_consortium', 'country', 'institution', 'regional_hub', 'eric', 'working_group'))
);
--> statement-breakpoint
CREATE TABLE "organisational_units" (
	"id" uuid PRIMARY KEY,
	"metadata" jsonb,
	"name" text NOT NULL,
	"acronym" text,
	"ror" text,
	"summary" text,
	"image_id" uuid,
	"type_id" uuid NOT NULL,
	"sshoc_marketplace_actor_id" integer,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisational_units_allowed_relations" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"unit_type_id" uuid NOT NULL,
	"related_unit_type_id" uuid NOT NULL,
	"relation_type_id" uuid NOT NULL,
	CONSTRAINT "organisational_units_allowed_relations_unit_type_id_related_unit_type_id_relation_type_id_unique" UNIQUE("unit_type_id","related_unit_type_id","relation_type_id")
);
--> statement-breakpoint
CREATE TABLE "organisational_units_to_units" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"unit_document_id" uuid NOT NULL,
	"related_unit_document_id" uuid NOT NULL,
	"duration" tstzrange NOT NULL,
	"status" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisational_units_to_social_media" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"organisational_unit_id" uuid NOT NULL,
	"social_media_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"image_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_role_types" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"type" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_role_types_type_enum_check" CHECK ("type" in ('is_affiliated_with', 'is_chair_of', 'is_vice_chair_of', 'is_member_of', 'is_contact_for', 'national_coordinator', 'national_coordinator_deputy', 'national_coordination_staff', 'national_representative', 'national_representative_deputy'))
);
--> statement-breakpoint
CREATE TABLE "person_role_types_to_organisational_unit_types" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"role_type_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	CONSTRAINT "person_role_types_to_organisational_unit_types_role_type_id_unit_type_id_unique" UNIQUE("role_type_id","unit_type_id")
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"sort_name" text NOT NULL,
	"email" text,
	"orcid" text,
	"image_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons_to_organisational_units" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"person_document_id" uuid NOT NULL,
	"organisational_unit_document_id" uuid NOT NULL,
	"role_type_id" uuid NOT NULL,
	"duration" tstzrange NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_roles" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"role" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_roles_role_enum_check" CHECK ("role" in ('coordinator', 'funder', 'participant', 'affiliated'))
);
--> statement-breakpoint
CREATE TABLE "project_scopes" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"scope" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_scopes_scope_enum_check" CHECK ("scope" in ('eu', 'national', 'regional'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY,
	"metadata" jsonb,
	"name" text NOT NULL,
	"acronym" text,
	"duration" tstzrange NOT NULL,
	"funding" numeric(12,2),
	"summary" text NOT NULL,
	"call" text,
	"topic" text,
	"image_id" uuid,
	"scope_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects_to_organisational_units" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"project_document_id" uuid NOT NULL,
	"unit_document_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"duration" tstzrange,
	CONSTRAINT "projects_to_organisational_units_project_role_unit_unique" UNIQUE("project_document_id","role_id","unit_document_id")
);
--> statement-breakpoint
CREATE TABLE "projects_to_social_media" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"project_id" uuid NOT NULL,
	"social_media_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_report_contributions" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"country_report_id" uuid NOT NULL,
	"person_to_org_unit_id" uuid NOT NULL,
	CONSTRAINT "country_report_contributions_country_report_id_person_to_org_unit_id_unique" UNIQUE("country_report_id","person_to_org_unit_id")
);
--> statement-breakpoint
CREATE TABLE "country_report_institutions" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"country_report_id" uuid NOT NULL,
	"organisational_unit_document_id" uuid NOT NULL,
	"representation_type" text,
	CONSTRAINT "country_report_institutions_country_report_id_organisational_unit_document_id_unique" UNIQUE("country_report_id","organisational_unit_document_id"),
	CONSTRAINT "country_report_institutions_representation_type_enum_check" CHECK ("representation_type" in ('is_national_coordinating_institution_in', 'is_national_representative_institution_in', 'is_partner_institution_of'))
);
--> statement-breakpoint
CREATE TABLE "country_report_project_contributions" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"country_report_id" uuid NOT NULL,
	"project_document_id" uuid NOT NULL,
	"amount_euros" numeric(12,2) NOT NULL,
	CONSTRAINT "country_report_project_contributions_country_report_id_project_document_id_unique" UNIQUE("country_report_id","project_document_id")
);
--> statement-breakpoint
CREATE TABLE "country_report_service_kpis" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"country_report_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"kpi" text NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "country_report_service_kpis_country_report_id_service_id_kpi_unique" UNIQUE("country_report_id","service_id","kpi"),
	CONSTRAINT "country_report_service_kpis_kpi_enum_check" CHECK ("kpi" in ('downloads', 'hits', 'items', 'jobs_processed', 'page_views', 'registered_users', 'searches', 'sessions', 'unique_users', 'visits', 'websites_hosted'))
);
--> statement-breakpoint
CREATE TABLE "country_report_social_media_kpis" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"country_report_id" uuid NOT NULL,
	"social_media_id" uuid NOT NULL,
	"kpi" text NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "country_report_social_media_kpis_country_report_id_social_media_id_kpi_unique" UNIQUE("country_report_id","social_media_id","kpi"),
	CONSTRAINT "country_report_social_media_kpis_kpi_enum_check" CHECK ("kpi" in ('engagement', 'followers', 'impressions', 'mentions', 'new_content', 'page_views', 'posts', 'reach', 'subscribers', 'unique_visitors', 'views', 'watch_time'))
);
--> statement-breakpoint
CREATE TABLE "country_reports" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"campaign_id" uuid NOT NULL,
	"country_document_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_contributors" integer,
	"small_events" integer,
	"medium_events" integer,
	"large_events" integer,
	"very_large_events" integer,
	"dariah_commissioned_event" text,
	"reusable_outcomes" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "country_reports_campaign_id_country_document_id_unique" UNIQUE("campaign_id","country_document_id"),
	CONSTRAINT "country_reports_status_enum_check" CHECK ("status" in ('draft', 'submitted', 'accepted'))
);
--> statement-breakpoint
CREATE TABLE "report_screen_comments" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"report_type" text NOT NULL,
	"report_id" uuid NOT NULL,
	"screen_key" text NOT NULL,
	"comment" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_screen_comments_report_type_report_id_screen_key_unique" UNIQUE("report_type","report_id","screen_key"),
	CONSTRAINT "report_screen_comments_report_type_enum_check" CHECK ("report_type" in ('country', 'working_group')),
	CONSTRAINT "report_screen_comments_screen_key_enum_check" CHECK ("screen_key" in ('institutions', 'contributors', 'events', 'social-media', 'services', 'software', 'publications', 'projects', 'data', 'questions', 'confirm'))
);
--> statement-breakpoint
CREATE TABLE "reporting_campaign_contribution_amounts" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"campaign_id" uuid NOT NULL,
	"role_type" text NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	CONSTRAINT "reporting_campaign_contribution_amounts_campaign_id_role_type_unique" UNIQUE("campaign_id","role_type"),
	CONSTRAINT "reporting_campaign_contribution_amounts_role_type_enum_check" CHECK ("role_type" in ('national_coordinator', 'national_coordinator_deputy', 'is_chair_of_jrc', 'is_chair_of_ncc', 'is_chair_of_wg', 'is_member_of_jrc'))
);
--> statement-breakpoint
CREATE TABLE "reporting_campaign_country_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"campaign_id" uuid NOT NULL,
	"country_document_id" uuid NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	CONSTRAINT "reporting_campaign_country_thresholds_campaign_id_country_document_id_unique" UNIQUE("campaign_id","country_document_id")
);
--> statement-breakpoint
CREATE TABLE "reporting_campaign_event_amounts" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"campaign_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	CONSTRAINT "reporting_campaign_event_amounts_campaign_id_event_type_unique" UNIQUE("campaign_id","event_type"),
	CONSTRAINT "reporting_campaign_event_amounts_event_type_enum_check" CHECK ("event_type" in ('small', 'medium', 'large', 'very_large', 'dariah_commissioned'))
);
--> statement-breakpoint
CREATE TABLE "reporting_campaign_service_sizes" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"campaign_id" uuid NOT NULL,
	"service_size" text NOT NULL,
	"visits_threshold" integer,
	"amount" numeric(12,2) NOT NULL,
	CONSTRAINT "reporting_campaign_service_sizes_campaign_id_service_size_unique" UNIQUE("campaign_id","service_size"),
	CONSTRAINT "reporting_campaign_service_sizes_service_size_enum_check" CHECK ("service_size" in ('small', 'medium', 'large', 'very_large', 'core'))
);
--> statement-breakpoint
CREATE TABLE "reporting_campaign_social_media_amounts" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"campaign_id" uuid NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	CONSTRAINT "reporting_campaign_social_media_amounts_campaign_id_category_unique" UNIQUE("campaign_id","category"),
	CONSTRAINT "reporting_campaign_social_media_amounts_category_enum_check" CHECK ("category" in ('website', 'other'))
);
--> statement-breakpoint
CREATE TABLE "reporting_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"year" integer NOT NULL UNIQUE,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reporting_campaigns_status_enum_check" CHECK ("status" in ('draft', 'open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "working_group_report_answers" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"working_group_report_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer" jsonb NOT NULL,
	CONSTRAINT "working_group_report_answers_working_group_report_id_question_id_unique" UNIQUE("working_group_report_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "working_group_report_events" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"working_group_report_id" uuid NOT NULL,
	"title" text NOT NULL,
	"date" timestamp(3) NOT NULL,
	"url" text,
	"role" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_group_report_questions" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"campaign_id" uuid NOT NULL,
	"question" jsonb NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "working_group_report_questions_campaign_id_position_unique" UNIQUE("campaign_id","position")
);
--> statement-breakpoint
CREATE TABLE "working_group_report_social_media" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"working_group_report_id" uuid NOT NULL,
	"social_media_id" uuid NOT NULL,
	CONSTRAINT "working_group_report_social_media_working_group_report_id_social_media_id_unique" UNIQUE("working_group_report_id","social_media_id")
);
--> statement-breakpoint
CREATE TABLE "working_group_reports" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"campaign_id" uuid NOT NULL,
	"working_group_document_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"number_of_members" integer,
	"mailing_list" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "working_group_reports_campaign_wg_document_unique" UNIQUE("campaign_id","working_group_document_id"),
	CONSTRAINT "working_group_reports_status_enum_check" CHECK ("status" in ('draft', 'submitted', 'accepted'))
);
--> statement-breakpoint
CREATE TABLE "organisational_unit_service_roles" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"role" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_statuses_status_enum_check" CHECK ("role" in ('service_owner', 'service_provider'))
);
--> statement-breakpoint
CREATE TABLE "service_statuses" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"status" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_statuses_status_enum_check" CHECK ("status" in ('discontinued', 'live', 'needs_review', 'to_be_discontinued'))
);
--> statement-breakpoint
CREATE TABLE "service_types" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"type" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_types_type_enum_check" CHECK ("type" in ('community', 'core', 'internal'))
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"name" text NOT NULL,
	"sshoc_marketplace_id" text,
	"type_id" uuid NOT NULL,
	"status_id" uuid NOT NULL,
	"comment" text,
	"dariah_branding" boolean,
	"monitoring" boolean,
	"private_supplier" boolean,
	"metadata" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services_to_organisational_units" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"service_id" uuid NOT NULL,
	"organisational_unit_document_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services_to_social_media" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"service_id" uuid NOT NULL,
	"social_media_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_metadata" (
	"id" integer PRIMARY KEY DEFAULT 1,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"og_title" text,
	"og_description" text,
	"og_image_id" uuid,
	"featured_item_ids" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_metadata_singleton" CHECK ("id" = 1)
);
--> statement-breakpoint
CREATE TABLE "social_media" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"name" text NOT NULL,
	"url" text NOT NULL,
	"duration" tstzrange,
	"type_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_media_types" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"type" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_media_types_type_enum_check" CHECK ("type" in ('bluesky', 'facebook', 'instagram', 'linkedin', 'mastodon', 'twitter', 'vimeo', 'website', 'youtube', 'other'))
);
--> statement-breakpoint
CREATE TABLE "spotlight_articles" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"image_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotlight_articles_to_persons" (
	"spotlight_article_document_id" uuid,
	"person_document_id" uuid,
	"role" text DEFAULT 'author' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spotlight_articles_to_persons_pkey" PRIMARY KEY("spotlight_article_document_id","person_document_id")
);
--> statement-breakpoint
CREATE TABLE "email_verification_requests" (
	"id" text PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_sessions" (
	"id" text PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"is_two_factor_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"secret_hash" bytea NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"is_two_factor_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"email" text NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"password_hash" text NOT NULL,
	"two_factor_totp_key" bytea,
	"two_factor_recovery_code" bytea NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"can_manage_admins" boolean DEFAULT false NOT NULL,
	"person_document_id" uuid,
	"organisational_unit_document_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_role_enum_check" CHECK ("role" in ('admin', 'user')),
	CONSTRAINT "users_can_manage_admins_requires_admin_role_check" CHECK (
					NOT (
						"can_manage_admins"
						AND "role" <> 'admin'
					)
				),
	CONSTRAINT "users_actor_xor_check" CHECK (
					NOT (
						"person_document_id" IS NOT NULL
						AND "organisational_unit_document_id" IS NOT NULL
					)
				)
);
--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_subject_idx" ON "audit_logs" ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" ("actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "background_jobs_one_running_per_kind" ON "background_jobs" ("kind") WHERE status = 'running';--> statement-breakpoint
CREATE INDEX "background_jobs_kind_started_at_idx" ON "background_jobs" ("kind","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" (LOWER("email"));--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_license_id_licenses_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id");--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_triggered_by_user_id_users_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "content_blocks_type_accordion" ADD CONSTRAINT "content_blocks_type_accordion_id_content_blocks_id_fkey" FOREIGN KEY ("id") REFERENCES "content_blocks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_field_id_fields_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id");--> statement-breakpoint
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_type_id_content_blocks_types_id_fkey" FOREIGN KEY ("type_id") REFERENCES "content_blocks_types"("id");--> statement-breakpoint
ALTER TABLE "content_blocks_type_data" ADD CONSTRAINT "content_blocks_type_data_id_content_blocks_id_fkey" FOREIGN KEY ("id") REFERENCES "content_blocks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_blocks_type_data" ADD CONSTRAINT "content_blocks_type_data_SC8kKM2VecFw_fkey" FOREIGN KEY ("type_id") REFERENCES "content_blocks_type_data_types"("id");--> statement-breakpoint
ALTER TABLE "content_blocks_type_embed" ADD CONSTRAINT "content_blocks_type_embed_id_content_blocks_id_fkey" FOREIGN KEY ("id") REFERENCES "content_blocks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_blocks_type_gallery_items" ADD CONSTRAINT "content_blocks_type_gallery_items_EDZe8SThKvBb_fkey" FOREIGN KEY ("gallery_content_block_id") REFERENCES "content_blocks_type_gallery"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_blocks_type_gallery_items" ADD CONSTRAINT "content_blocks_type_gallery_items_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "content_blocks_type_gallery" ADD CONSTRAINT "content_blocks_type_gallery_id_content_blocks_id_fkey" FOREIGN KEY ("id") REFERENCES "content_blocks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_blocks_type_hero" ADD CONSTRAINT "content_blocks_type_hero_id_content_blocks_id_fkey" FOREIGN KEY ("id") REFERENCES "content_blocks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_blocks_type_hero" ADD CONSTRAINT "content_blocks_type_hero_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "content_blocks_type_image" ADD CONSTRAINT "content_blocks_type_image_id_content_blocks_id_fkey" FOREIGN KEY ("id") REFERENCES "content_blocks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_blocks_type_image" ADD CONSTRAINT "content_blocks_type_image_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "content_blocks_type_rich_text" ADD CONSTRAINT "content_blocks_type_rich_text_id_content_blocks_id_fkey" FOREIGN KEY ("id") REFERENCES "content_blocks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "documentation_pages" ADD CONSTRAINT "documentation_pages_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "documents_policies" ADD CONSTRAINT "documents_policies_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "documents_policies" ADD CONSTRAINT "documents_policies_document_id_assets_id_fkey" FOREIGN KEY ("document_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "documents_policies" ADD CONSTRAINT "documents_policies_group_id_document_policy_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "document_policy_groups"("id");--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_type_id_entity_types_id_fkey" FOREIGN KEY ("type_id") REFERENCES "entity_types"("id");--> statement-breakpoint
ALTER TABLE "entities_to_entities" ADD CONSTRAINT "entities_to_entities_entity_id_entities_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "entities_to_entities" ADD CONSTRAINT "entities_to_entities_related_entity_id_entities_id_fkey" FOREIGN KEY ("related_entity_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "entities_to_resources" ADD CONSTRAINT "entities_to_resources_entity_id_entities_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "entity_types_fields_names" ADD CONSTRAINT "entity_types_fields_names_entity_type_id_entity_types_id_fkey" FOREIGN KEY ("entity_type_id") REFERENCES "entity_types"("id");--> statement-breakpoint
ALTER TABLE "entity_versions" ADD CONSTRAINT "entity_versions_entity_id_entities_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "entity_versions" ADD CONSTRAINT "entity_versions_status_id_entity_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "entity_status"("id");--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_entity_version_id_entity_versions_id_fkey" FOREIGN KEY ("entity_version_id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_field_name_id_entity_types_fields_names_id_fkey" FOREIGN KEY ("field_name_id") REFERENCES "entity_types_fields_names"("id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "funding_calls" ADD CONSTRAINT "funding_calls_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "impact_case_studies" ADD CONSTRAINT "impact_case_studies_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "impact_case_studies" ADD CONSTRAINT "impact_case_studies_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "impact_case_studies_to_persons" ADD CONSTRAINT "impact_case_studies_to_persons_JaNg0ZewnLU4_fkey" FOREIGN KEY ("impact_case_study_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "impact_case_studies_to_persons" ADD CONSTRAINT "impact_case_studies_to_persons_gJKBmM4InNhw_fkey" FOREIGN KEY ("person_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "internal_pages" ADD CONSTRAINT "internal_pages_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_menu_id_navigation_menus_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "navigation_menus"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_parent_id_navigation_items_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "navigation_items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_entity_id_entities_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_source_id_opportunity_sources_id_fkey" FOREIGN KEY ("source_id") REFERENCES "opportunity_sources"("id");--> statement-breakpoint
ALTER TABLE "organisational_units" ADD CONSTRAINT "organisational_units_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "organisational_units" ADD CONSTRAINT "organisational_units_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "organisational_units" ADD CONSTRAINT "organisational_units_type_id_organisational_unit_types_id_fkey" FOREIGN KEY ("type_id") REFERENCES "organisational_unit_types"("id");--> statement-breakpoint
ALTER TABLE "organisational_units_allowed_relations" ADD CONSTRAINT "organisational_units_allowed_relations_obldlDawRu4b_fkey" FOREIGN KEY ("unit_type_id") REFERENCES "organisational_unit_types"("id");--> statement-breakpoint
ALTER TABLE "organisational_units_allowed_relations" ADD CONSTRAINT "organisational_units_allowed_relations_GeeY3pIymUWv_fkey" FOREIGN KEY ("related_unit_type_id") REFERENCES "organisational_unit_types"("id");--> statement-breakpoint
ALTER TABLE "organisational_units_allowed_relations" ADD CONSTRAINT "organisational_units_allowed_relations_xJRyGoY0o7ag_fkey" FOREIGN KEY ("relation_type_id") REFERENCES "organisational_unit_status"("id");--> statement-breakpoint
ALTER TABLE "organisational_units_to_units" ADD CONSTRAINT "organisational_units_to_units_unit_document_id_entities_id_fkey" FOREIGN KEY ("unit_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "organisational_units_to_units" ADD CONSTRAINT "organisational_units_to_units_qFCnMWHGe2ik_fkey" FOREIGN KEY ("related_unit_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "organisational_units_to_units" ADD CONSTRAINT "organisational_units_to_units_KaSG9Djonlvo_fkey" FOREIGN KEY ("status") REFERENCES "organisational_unit_status"("id");--> statement-breakpoint
ALTER TABLE "organisational_units_to_social_media" ADD CONSTRAINT "organisational_units_to_social_media_37PSjxkhQTFd_fkey" FOREIGN KEY ("organisational_unit_id") REFERENCES "organisational_units"("id");--> statement-breakpoint
ALTER TABLE "organisational_units_to_social_media" ADD CONSTRAINT "organisational_units_to_social_media_HAdqvoewtQo4_fkey" FOREIGN KEY ("social_media_id") REFERENCES "social_media"("id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "person_role_types_to_organisational_unit_types" ADD CONSTRAINT "lQrEcIXVQZNA_fkey" FOREIGN KEY ("role_type_id") REFERENCES "person_role_types"("id");--> statement-breakpoint
ALTER TABLE "person_role_types_to_organisational_unit_types" ADD CONSTRAINT "xztRclXXlxgi_fkey" FOREIGN KEY ("unit_type_id") REFERENCES "organisational_unit_types"("id");--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "persons_to_organisational_units" ADD CONSTRAINT "persons_to_organisational_units_WDHiGvRf4IIu_fkey" FOREIGN KEY ("person_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "persons_to_organisational_units" ADD CONSTRAINT "persons_to_organisational_units_SvHtXbe6sadX_fkey" FOREIGN KEY ("organisational_unit_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "persons_to_organisational_units" ADD CONSTRAINT "persons_to_organisational_units_bxz0xldNkDyL_fkey" FOREIGN KEY ("role_type_id") REFERENCES "person_role_types"("id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_scope_id_project_scopes_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "project_scopes"("id");--> statement-breakpoint
ALTER TABLE "projects_to_organisational_units" ADD CONSTRAINT "projects_to_organisational_units_o7hYCl5e0uxA_fkey" FOREIGN KEY ("project_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "projects_to_organisational_units" ADD CONSTRAINT "projects_to_organisational_units_u9CAhcX3UcLN_fkey" FOREIGN KEY ("unit_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "projects_to_organisational_units" ADD CONSTRAINT "projects_to_organisational_units_role_id_project_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "project_roles"("id");--> statement-breakpoint
ALTER TABLE "projects_to_social_media" ADD CONSTRAINT "projects_to_social_media_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id");--> statement-breakpoint
ALTER TABLE "projects_to_social_media" ADD CONSTRAINT "projects_to_social_media_social_media_id_social_media_id_fkey" FOREIGN KEY ("social_media_id") REFERENCES "social_media"("id");--> statement-breakpoint
ALTER TABLE "country_report_contributions" ADD CONSTRAINT "country_report_contributions_wmuZ1hsiHFkC_fkey" FOREIGN KEY ("country_report_id") REFERENCES "country_reports"("id");--> statement-breakpoint
ALTER TABLE "country_report_contributions" ADD CONSTRAINT "country_report_contributions_IpWgzKUKya6A_fkey" FOREIGN KEY ("person_to_org_unit_id") REFERENCES "persons_to_organisational_units"("id");--> statement-breakpoint
ALTER TABLE "country_report_institutions" ADD CONSTRAINT "country_report_institutions_5L6rUxWrxrXy_fkey" FOREIGN KEY ("country_report_id") REFERENCES "country_reports"("id");--> statement-breakpoint
ALTER TABLE "country_report_institutions" ADD CONSTRAINT "country_report_institutions_uMUSzM5dk9oc_fkey" FOREIGN KEY ("organisational_unit_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "country_report_project_contributions" ADD CONSTRAINT "country_report_project_contributions_0fN6q2GklCHm_fkey" FOREIGN KEY ("country_report_id") REFERENCES "country_reports"("id");--> statement-breakpoint
ALTER TABLE "country_report_project_contributions" ADD CONSTRAINT "country_report_project_contributions_s8WHzjeoJVKl_fkey" FOREIGN KEY ("project_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "country_report_service_kpis" ADD CONSTRAINT "country_report_service_kpis_C5cQ9xGF9dqi_fkey" FOREIGN KEY ("country_report_id") REFERENCES "country_reports"("id");--> statement-breakpoint
ALTER TABLE "country_report_service_kpis" ADD CONSTRAINT "country_report_service_kpis_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id");--> statement-breakpoint
ALTER TABLE "country_report_social_media_kpis" ADD CONSTRAINT "country_report_social_media_kpis_jafTao9CYh2j_fkey" FOREIGN KEY ("country_report_id") REFERENCES "country_reports"("id");--> statement-breakpoint
ALTER TABLE "country_report_social_media_kpis" ADD CONSTRAINT "country_report_social_media_kpis_iG19QiyAWKzo_fkey" FOREIGN KEY ("social_media_id") REFERENCES "social_media"("id");--> statement-breakpoint
ALTER TABLE "country_reports" ADD CONSTRAINT "country_reports_campaign_id_reporting_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "reporting_campaigns"("id");--> statement-breakpoint
ALTER TABLE "country_reports" ADD CONSTRAINT "country_reports_country_document_id_entities_id_fkey" FOREIGN KEY ("country_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "reporting_campaign_contribution_amounts" ADD CONSTRAINT "reporting_campaign_contribution_amounts_9NAMXZnsMjDE_fkey" FOREIGN KEY ("campaign_id") REFERENCES "reporting_campaigns"("id");--> statement-breakpoint
ALTER TABLE "reporting_campaign_country_thresholds" ADD CONSTRAINT "reporting_campaign_country_thresholds_rKFwM4dtItJF_fkey" FOREIGN KEY ("campaign_id") REFERENCES "reporting_campaigns"("id");--> statement-breakpoint
ALTER TABLE "reporting_campaign_country_thresholds" ADD CONSTRAINT "reporting_campaign_country_thresholds_5FaAzAoBIKBY_fkey" FOREIGN KEY ("country_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "reporting_campaign_event_amounts" ADD CONSTRAINT "reporting_campaign_event_amounts_byz19OQ5p7cA_fkey" FOREIGN KEY ("campaign_id") REFERENCES "reporting_campaigns"("id");--> statement-breakpoint
ALTER TABLE "reporting_campaign_service_sizes" ADD CONSTRAINT "reporting_campaign_service_sizes_SF6Y7uUkO7Km_fkey" FOREIGN KEY ("campaign_id") REFERENCES "reporting_campaigns"("id");--> statement-breakpoint
ALTER TABLE "reporting_campaign_social_media_amounts" ADD CONSTRAINT "reporting_campaign_social_media_amounts_zeHcsUOkdLDW_fkey" FOREIGN KEY ("campaign_id") REFERENCES "reporting_campaigns"("id");--> statement-breakpoint
ALTER TABLE "working_group_report_answers" ADD CONSTRAINT "working_group_report_answers_5LfLJ9ox6VOR_fkey" FOREIGN KEY ("working_group_report_id") REFERENCES "working_group_reports"("id");--> statement-breakpoint
ALTER TABLE "working_group_report_answers" ADD CONSTRAINT "working_group_report_answers_krXtcykTCBnq_fkey" FOREIGN KEY ("question_id") REFERENCES "working_group_report_questions"("id");--> statement-breakpoint
ALTER TABLE "working_group_report_events" ADD CONSTRAINT "working_group_report_events_vzQHVLL2c78D_fkey" FOREIGN KEY ("working_group_report_id") REFERENCES "working_group_reports"("id");--> statement-breakpoint
ALTER TABLE "working_group_report_questions" ADD CONSTRAINT "working_group_report_questions_tk2oUQamvzJk_fkey" FOREIGN KEY ("campaign_id") REFERENCES "reporting_campaigns"("id");--> statement-breakpoint
ALTER TABLE "working_group_report_social_media" ADD CONSTRAINT "working_group_report_social_media_idcb6mmv6omk_fkey" FOREIGN KEY ("working_group_report_id") REFERENCES "working_group_reports"("id");--> statement-breakpoint
ALTER TABLE "working_group_report_social_media" ADD CONSTRAINT "working_group_report_social_media_1E6KM0o2rRol_fkey" FOREIGN KEY ("social_media_id") REFERENCES "social_media"("id");--> statement-breakpoint
ALTER TABLE "working_group_reports" ADD CONSTRAINT "working_group_reports_campaign_id_reporting_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "reporting_campaigns"("id");--> statement-breakpoint
ALTER TABLE "working_group_reports" ADD CONSTRAINT "working_group_reports_IzXYVMFw5mUP_fkey" FOREIGN KEY ("working_group_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_type_id_service_types_id_fkey" FOREIGN KEY ("type_id") REFERENCES "service_types"("id");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_status_id_service_statuses_id_fkey" FOREIGN KEY ("status_id") REFERENCES "service_statuses"("id");--> statement-breakpoint
ALTER TABLE "services_to_organisational_units" ADD CONSTRAINT "services_to_organisational_units_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id");--> statement-breakpoint
ALTER TABLE "services_to_organisational_units" ADD CONSTRAINT "services_to_organisational_units_B6aBAxsdfeXN_fkey" FOREIGN KEY ("organisational_unit_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "services_to_organisational_units" ADD CONSTRAINT "services_to_organisational_units_WvucThz65V4q_fkey" FOREIGN KEY ("role_id") REFERENCES "organisational_unit_service_roles"("id");--> statement-breakpoint
ALTER TABLE "services_to_social_media" ADD CONSTRAINT "services_to_social_media_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id");--> statement-breakpoint
ALTER TABLE "services_to_social_media" ADD CONSTRAINT "services_to_social_media_social_media_id_social_media_id_fkey" FOREIGN KEY ("social_media_id") REFERENCES "social_media"("id");--> statement-breakpoint
ALTER TABLE "site_metadata" ADD CONSTRAINT "site_metadata_og_image_id_assets_id_fkey" FOREIGN KEY ("og_image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "social_media" ADD CONSTRAINT "social_media_type_id_social_media_types_id_fkey" FOREIGN KEY ("type_id") REFERENCES "social_media_types"("id");--> statement-breakpoint
ALTER TABLE "spotlight_articles" ADD CONSTRAINT "spotlight_articles_id_entity_versions_id_fkey" FOREIGN KEY ("id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "spotlight_articles" ADD CONSTRAINT "spotlight_articles_image_id_assets_id_fkey" FOREIGN KEY ("image_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "spotlight_articles_to_persons" ADD CONSTRAINT "spotlight_articles_to_persons_OQtNeXfyDcDJ_fkey" FOREIGN KEY ("spotlight_article_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "spotlight_articles_to_persons" ADD CONSTRAINT "spotlight_articles_to_persons_M1usKTpbwZXz_fkey" FOREIGN KEY ("person_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "email_verification_requests" ADD CONSTRAINT "email_verification_requests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "password_reset_sessions" ADD CONSTRAINT "password_reset_sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_person_document_id_entities_id_fkey" FOREIGN KEY ("person_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organisational_unit_document_id_entities_id_fkey" FOREIGN KEY ("organisational_unit_document_id") REFERENCES "entities"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_versions_entity_status_idx" ON "entity_versions" ("entity_id", "status_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_versions_status_entity_idx" ON "entity_versions" ("status_id", "entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_to_entities_related_entity_idx" ON "entities_to_entities" ("related_entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organisational_units_to_units_related_unit_status_idx" ON "organisational_units_to_units" ("related_unit_document_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organisational_units_to_units_unit_status_idx" ON "organisational_units_to_units" ("unit_document_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persons_to_organisational_units_unit_role_idx" ON "persons_to_organisational_units" ("organisational_unit_document_id", "role_type_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persons_to_organisational_units_person_role_idx" ON "persons_to_organisational_units" ("person_document_id", "role_type_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_to_organisational_units_unit_role_idx" ON "projects_to_organisational_units" ("unit_document_id", "role_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "services_to_organisational_units_service_role_idx" ON "services_to_organisational_units" ("service_id", "role_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "services_to_organisational_units_unit_role_idx" ON "services_to_organisational_units" ("organisational_unit_document_id", "role_id");

--> statement-breakpoint
CREATE VIEW document_lifecycle AS
SELECT
	"entities"."id" AS "document_id",
	"entities"."type_id",
	"draft_versions"."id" AS "draft_id",
	"draft_versions"."updated_at" AS "draft_updated_at",
	"published_versions"."id" AS "published_id",
	"published_versions"."updated_at" AS "published_updated_at",
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
	LEFT JOIN "entity_versions" "published_versions"
		ON "published_versions"."entity_id" = "entities"."id"
		AND "published_versions"."status_id" = (
			SELECT "id" FROM "entity_status" WHERE "type" = 'published'
		)
WHERE
	"draft_versions"."id" IS NOT NULL
	OR "published_versions"."id" IS NOT NULL;

--> statement-breakpoint
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
	"units"."id", "units"."metadata", "units"."name", "units"."acronym", "units"."summary", "units"."updated_at",
	"unit_types"."type", "units"."image_id", "units"."sshoc_marketplace_actor_id", "unit_status"."status";

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
CREATE VIEW statistics AS
SELECT
  (
    SELECT COUNT(DISTINCT uv."entity_id")::integer
    FROM "organisational_units" u
    JOIN "entity_versions" uv ON uv."id" = u."id"
    JOIN "entity_status" us ON us."id" = uv."status_id" AND us."type" = 'published'
    JOIN "organisational_unit_types" t ON u."type_id" = t."id" AND t."type" = 'country'
    JOIN "organisational_units_to_units" r ON r."unit_document_id" = uv."entity_id" AND r."duration" @> NOW()
    JOIN "organisational_unit_status" s ON r."status" = s."id" AND s."status" = 'is_member_of'
    JOIN "entity_versions" rv ON rv."entity_id" = r."related_unit_document_id"
    JOIN "entity_status" rs ON rs."id" = rv."status_id" AND rs."type" = 'published'
    JOIN "organisational_units" related ON related."id" = rv."id"
    JOIN "organisational_unit_types" related_t ON related."type_id" = related_t."id" AND related_t."type" = 'eric'
    JOIN "entities" eric_e ON eric_e."id" = r."related_unit_document_id" AND eric_e."slug" = 'dariah-eu'
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
    JOIN "entities" eric_e ON eric_e."id" = r."related_unit_document_id" AND eric_e."slug" = 'dariah-eu'
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
    JOIN "entities" eric_e ON eric_e."id" = r."related_unit_document_id" AND eric_e."slug" = 'dariah-eu'
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
    JOIN "entities" eric_e ON eric_e."id" = r."related_unit_document_id" AND eric_e."slug" = 'dariah-eu'
  ) AS "working_groups";

--> statement-breakpoint
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
