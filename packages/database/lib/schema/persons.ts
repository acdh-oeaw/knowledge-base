import type { JSONContent } from "@tiptap/core";
import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { assets } from "./assets";
import { entities, entityVersions } from "./entities";
import { imageCaptionModeColumn, imageCaptionModesEnum } from "./image-captions";
import { organisationalUnitTypes } from "./organisational-units";

export const personRoleTypesEnum = [
	"is_affiliated_with",
	"is_chair_of",
	"is_vice_chair_of",
	"is_member_of",
	"is_contact_for",
	"is_content_manager_for",
	"national_coordinator",
	"national_coordinator_deputy",
	"national_coordination_staff",
	"national_representative",
	"national_representative_deputy",
] as const;

export const persons = p.snakeCase.table(
	"persons",
	{
		id: p
			.uuid("id")
			.primaryKey()
			.references(() => entityVersions.id),
		name: p.text("name").notNull(),
		sortName: p.text("sort_name").notNull(),
		email: p.text("email"),
		orcid: p.text("orcid"),
		imageId: p.uuid("image_id").references(() => assets.id),
		/**
		 * Caption for the portrait at this placement — typically the photo credit. `inherit` shows the
		 * asset's own caption, `override` shows {@link imageCaption}, `hidden` shows none, exactly as
		 * for image content blocks (see `imageCaptionModesEnum`).
		 */
		imageCaption: p.jsonb("image_caption").$type<JSONContent>(),
		imageCaptionMode: imageCaptionModeColumn("image_caption_mode"),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"persons_image_caption_mode_enum_check",
			inArray(t.imageCaptionMode, imageCaptionModesEnum),
		),
	],
);

export type Person = typeof persons.$inferSelect;
export type PersonInput = typeof persons.$inferInsert;

export const PersonSelectSchema = createSelectSchema(persons);
export const PersonInsertSchema = createInsertSchema(persons);
export const PersonUpdateSchema = createUpdateSchema(persons);

/**
 * Vocabulary for {@link personSocialMedia}: the platforms a person can have an account on.
 *
 * Deliberately separate from `social_media_types` rather than a filtered view of it. The two sets
 * overlap (bluesky, mastodon, linkedin, …) but neither contains the other — `google_scholar` and
 * `researchgate` are person-only, `facebook`/`instagram`/`vimeo` are outreach-only — and a separate
 * lookup table makes that a foreign-key constraint instead of a rule each picker has to apply.
 *
 * `orcid` is deliberately absent: it lives on {@link persons} as an identifier column, and having
 * it here too would give a person two places to put the same thing.
 */
export const personSocialMediaTypesEnum = [
	"academia_edu",
	"bluesky",
	"github",
	"gitlab",
	"google_scholar",
	"humanities_commons",
	"hypotheses",
	"linkedin",
	"mastodon",
	"researchgate",
	"twitter",
	"website",
	"youtube",
	"zenodo",
	"other",
] as const;

export const personSocialMediaTypes = p.snakeCase.table(
	"person_social_media_types",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		type: p.text("type", { enum: personSocialMediaTypesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"person_social_media_types_type_enum_check",
			inArray(t.type, personSocialMediaTypesEnum),
		),
	],
);

export type PersonSocialMediaType = typeof personSocialMediaTypes.$inferSelect;
export type PersonSocialMediaTypeInput = typeof personSocialMediaTypes.$inferInsert;

export const PersonSocialMediaTypeSelectSchema = createSelectSchema(personSocialMediaTypes);
export const PersonSocialMediaTypeInsertSchema = createInsertSchema(personSocialMediaTypes);
export const PersonSocialMediaTypeUpdateSchema = createUpdateSchema(personSocialMediaTypes);

/**
 * A person's own social media — personal website, Bluesky, GitHub, and so on. These are rows owned
 * by a single person version, not entries in the shared {@link socialMedia} table: they are never
 * shared between owners, carry no `duration`, and must stay unreachable from the outreach reporting
 * tables (`country_report_social_media` and friends all reference `social_media.id`). That is the
 * whole distinction between the two: outbound channels DARIAH reports KPIs on, versus a person's
 * own presence on a platform.
 *
 * Contrast the two other web-address-ish columns on a person: `email` is an inbound contact
 * channel, and `orcid` is an identifier — both stay as columns on {@link persons}.
 *
 * Version-scoped (`person_id` references `persons.id`, a version id) because a person's entries are
 * an attribute of the version, like `image_id`. `personsLifecycleAdapter` therefore has to clone
 * and wipe these rows alongside the subtype row.
 */
export const personSocialMedia = p.snakeCase.table(
	"person_social_media",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		personId: p
			.uuid("person_id")
			.notNull()
			.references(() => persons.id),
		typeId: p
			.uuid("type_id")
			.notNull()
			.references(() => personSocialMediaTypes.id),
		url: p.text("url").notNull(),
		/** Optional display name for the link, e.g. a handle. Falls back to the type label. */
		label: p.text("label"),
		position: p.integer("position").notNull().default(0),
		...f.timestamps(),
	},
	// Scoped to the version, so a draft and its published copy can hold the same url.
	(t) => [p.unique().on(t.personId, t.url)],
);

export type PersonSocialMedia = typeof personSocialMedia.$inferSelect;
export type PersonSocialMediaInput = typeof personSocialMedia.$inferInsert;

export const PersonSocialMediaSelectSchema = createSelectSchema(personSocialMedia);
export const PersonSocialMediaInsertSchema = createInsertSchema(personSocialMedia);
export const PersonSocialMediaUpdateSchema = createUpdateSchema(personSocialMedia);

export const personRoleTypes = p.snakeCase.table(
	"person_role_types",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		type: p.text("type", { enum: personRoleTypesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [p.check("person_role_types_type_enum_check", inArray(t.type, personRoleTypesEnum))],
);

/**
 * Document-level relation: a person's membership/role in an organisational unit. Both endpoints
 * reference `entities.id` (document IDs), not version IDs, so a relation is stable across the
 * draft/publish lifecycle of either side and is never cloned by the lifecycle adapters. Public
 * reads resolve each endpoint through its published version; admin reads through
 * draft-or-published.
 */
export const personsToOrganisationalUnits = p.snakeCase.table(
	"persons_to_organisational_units",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		personDocumentId: p
			.uuid("person_document_id")
			.notNull()
			.references(() => entities.id),
		organisationalUnitDocumentId: p
			.uuid("organisational_unit_document_id")
			.notNull()
			.references(() => entities.id),
		roleTypeId: p
			.uuid("role_type_id")
			.notNull()
			.references(() => personRoleTypes.id),
		duration: f.timestampRange("duration").notNull(),
		/** Optional free-text note describing the relation. */
		description: p.text("description"),
		...f.timestamps(),
	},
	// The same (person, org, role) relation may recur over non-overlapping periods, so uniqueness is
	// enforced by a GiST exclusion constraint on the duration (drizzle has no builder for it, so it
	// lives in the migration `*_person_org_role_no_overlap`), not a plain unique constraint here.
);

export type PersonToOrganisationalUnit = typeof personsToOrganisationalUnits.$inferSelect;
export type PersonToOrganisationalUnitInput = typeof personsToOrganisationalUnits.$inferInsert;

export const PersonToOrganisationalUnitSelectSchema = createSelectSchema(
	personsToOrganisationalUnits,
);
export const PersonToOrganisationalUnitInsertSchema = createInsertSchema(
	personsToOrganisationalUnits,
);
export const PersonToOrganisationalUnitUpdateSchema = createUpdateSchema(
	personsToOrganisationalUnits,
);

export const personRoleTypesToOrganisationalUnitTypesAllowedRelations = p.snakeCase.table(
	"person_role_types_to_organisational_unit_types",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		roleTypeId: p
			.uuid("role_type_id")
			.notNull()
			.references(() => personRoleTypes.id),
		unitTypeId: p
			.uuid("unit_type_id")
			.notNull()
			.references(() => organisationalUnitTypes.id),
	},
	(t) => [p.unique().on(t.roleTypeId, t.unitTypeId)],
);
