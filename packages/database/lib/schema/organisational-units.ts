import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { assets } from "./assets";
import { entities, entityVersions } from "./entities";
import { socialMedia } from "./social-media";

export const organisationalUnitTypesEnum = [
	"governance_body",
	"national_consortium",
	"country",
	"institution",
	"regional_hub",
	"eric",
	"working_group",
] as const;

export const organisationalUnitTypes = p.snakeCase.table(
	"organisational_unit_types",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		type: p.text("type", { enum: organisationalUnitTypesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"organisational_unit_types_type_enum_check",
			inArray(t.type, organisationalUnitTypesEnum),
		),
	],
);

export const organisationalUnitStatusEnum = [
	"is_located_in",
	"is_member_of",
	"is_national_consortium_of",
	"is_national_coordinating_institution_in",
	"is_national_representative_institution_in",
	"is_observer_of",
	"is_cooperating_partner_of",
	"is_part_of",
	"is_partner_institution_of",
] as const;

export const organisationalUnitStatus = p.snakeCase.table(
	"organisational_unit_status",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		status: p.text("status", { enum: organisationalUnitStatusEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"organisational_unit_status_status_enum_check",
			inArray(t.status, organisationalUnitStatusEnum),
		),
	],
);

export const organisationalUnits = p.snakeCase.table("organisational_units", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => entityVersions.id),
	metadata: p.jsonb("metadata"),
	name: p.text("name").notNull(),
	acronym: p.text("acronym"),
	ror: p.text("ror"),
	summary: p.text("summary"),
	imageId: p.uuid("image_id").references(() => assets.id),
	typeId: p
		.uuid("type_id")
		.notNull()
		.references(() => organisationalUnitTypes.id),
	sshocMarketplaceActorId: p.integer("sshoc_marketplace_actor_id"),
	...f.timestamps(),
});

export type OrganisationalUnit = typeof organisationalUnits.$inferSelect;
export type OrganisationalUnitInput = typeof organisationalUnits.$inferInsert;

export const OrganisationalUnitSelectSchema = createSelectSchema(organisationalUnits);
export const OrganisationalUnitInsertSchema = createInsertSchema(organisationalUnits);
export const OrganisationalUnitUpdateSchema = createUpdateSchema(organisationalUnits);

/**
 * Document-level relation: a directed relation between two organisational units (e.g. is_member_of,
 * is_located_in, is_cooperating_partner_of). Both endpoints reference `entities.id` (document IDs),
 * not version IDs, so the relation is stable across the draft/publish lifecycle of either side and
 * is never cloned by the lifecycle adapters. Public reads resolve each endpoint through its
 * published version; admin reads through draft-or-published.
 */
export const organisationalUnitsRelations = p.snakeCase.table(
	"organisational_units_to_units",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		unitDocumentId: p
			.uuid("unit_document_id")
			.notNull()
			.references(() => entities.id),
		relatedUnitDocumentId: p
			.uuid("related_unit_document_id")
			.notNull()
			.references(() => entities.id),
		duration: f.timestampRange("duration").notNull(),
		status: p
			.uuid("status")
			.notNull()
			.references(() => organisationalUnitStatus.id),
	},
	// The same (unit, related unit, status) relation may recur over non-overlapping periods, so
	// uniqueness is enforced by a GiST exclusion constraint on the duration (drizzle has no builder
	// for it, so it lives in the migration `*_unit_related_status_no_overlap`), not a plain unique
	// constraint here.
);

export type OrganisationalUnitRelation = typeof organisationalUnitsRelations.$inferSelect;
export type OrganisationalUnitRelationInput = typeof organisationalUnitsRelations.$inferInsert;

export const OrganisationalUnitRelationSelectSchema = createSelectSchema(
	organisationalUnitsRelations,
	{ duration: f.TimestampRange },
);
export const OrganisationalUnitRelationInsertSchema = createInsertSchema(
	organisationalUnitsRelations,
	{ duration: f.TimestampRange },
);
export const OrganisationalUnitRelationUpdateSchema = createUpdateSchema(
	organisationalUnitsRelations,
	{ duration: f.TimestampRange },
);

export const organisationalUnitsAllowedRelations = p.snakeCase.table(
	"organisational_units_allowed_relations",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		unitTypeId: p
			.uuid("unit_type_id")
			.notNull()
			.references(() => organisationalUnitTypes.id),
		relatedUnitTypeId: p
			.uuid("related_unit_type_id")
			.notNull()
			.references(() => organisationalUnitTypes.id),
		relationTypeId: p
			.uuid("relation_type_id")
			.notNull()
			.references(() => organisationalUnitStatus.id),
	},
	(t) => [p.unique().on(t.unitTypeId, t.relatedUnitTypeId, t.relationTypeId)],
);

export type OrganisationalUnitAllowedRelation =
	typeof organisationalUnitsAllowedRelations.$inferSelect;
export type OrganisationalUnitAllowedRelationInput =
	typeof organisationalUnitsAllowedRelations.$inferInsert;

export const OrganisationalUnitAllowedRelationSelectSchema = createSelectSchema(
	organisationalUnitsAllowedRelations,
);
export const OrganisationalUnitAllowedRelationInsertSchema = createInsertSchema(
	organisationalUnitsAllowedRelations,
);
export const OrganisationalUnitAllowedRelationUpdateSchema = createUpdateSchema(
	organisationalUnitsAllowedRelations,
);

export const organisationalUnitsToSocialMedia = p.snakeCase.table(
	"organisational_units_to_social_media",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		organisationalUnitId: p
			.uuid("organisational_unit_id")
			.notNull()
			.references(() => organisationalUnits.id),
		socialMediaId: p
			.uuid("social_media_id")
			.notNull()
			.references(() => socialMedia.id),
		...f.timestamps(),
	},
);

export type OrganisationalUnitToSocialMedia = typeof organisationalUnitsToSocialMedia.$inferSelect;
export type OrganisationalUnitToSocialMediaInput =
	typeof organisationalUnitsToSocialMedia.$inferInsert;

export const OrganisationalUnitToSocialMediaSelectSchema = createSelectSchema(
	organisationalUnitsToSocialMedia,
);
export const OrganisationalUnitToSocialMediaInsertSchema = createInsertSchema(
	organisationalUnitsToSocialMedia,
);
export const OrganisationalUnitToSocialMediaUpdateSchema = createUpdateSchema(
	organisationalUnitsToSocialMedia,
);

export const membersAndPartnersUnitType = "country";

export const membersAndPartnersUnitStatusEnum = [
	"is_member_of",
	"is_observer_of",
	"is_cooperating_partner_of",
] as const;

export const membersAndPartners = p.snakeCase
	.view("members_and_partners", {
		id: p.uuid("id").notNull(),
		metadata: p.jsonb("metadata"),
		name: p.text("name").notNull(),
		summary: p.text("summary"),
		updatedAt: f.timestamp("updated_at").notNull(),
		type: p.text("type"),
		status: p.text("status"),
		slug: p.text("slug"),
		imageId: p.uuid("image_id"),
		sshocMarketplaceActorId: p.integer("sshoc_marketplace_actor_id"),
	})
	.existing();

export const workingGroupUnitType = "working_group";

export const workingGroups = p.snakeCase
	.view("working_groups", {
		id: p.uuid("id").notNull(),
		/** TODO: Holds activities, disciplines, memberTracking, mailingList, contactEmail. */
		metadata: p.jsonb("metadata").$type<{
			activities?: string;
			disciplines?: string;
			memberTracking?: string;
			mailingList?: string;
			contactEmail?: string;
		}>(),
		name: p.text("name").notNull(),
		acronym: p.text("acronym"),
		summary: p.text("summary"),
		updatedAt: f.timestamp("updated_at").notNull(),
		imageId: p.uuid("image_id"),
		sshocMarketplaceActorId: p.integer("sshoc_marketplace_actor_id"),
	})
	.existing();

export const statistics = p.snakeCase
	.view("statistics", {
		memberCountries: p.integer("member_countries"),
		partnerInstitutions: p.integer("partner_institutions"),
		cooperatingPartners: p.integer("cooperating_partners"),
		workingGroups: p.integer("working_groups"),
	})
	.existing();

export const StatisticSelectSchema = createSelectSchema(statistics);
