import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { assets } from "./assets";
import { entities, entityVersions } from "./entities";
import { organisationalUnitTypes } from "./organisational-units";

export const personRoleTypesEnum = [
	"is_affiliated_with",
	"is_chair_of",
	"is_vice_chair_of",
	"is_member_of",
	"is_contact_for",
	"national_coordinator",
	"national_coordinator_deputy",
	"national_coordination_staff",
	"national_representative",
	"national_representative_deputy",
] as const;

export const persons = p.snakeCase.table("persons", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => entityVersions.id),
	name: p.text("name").notNull(),
	sortName: p.text("sort_name").notNull(),
	email: p.text("email"),
	orcid: p.text("orcid"),
	imageId: p.uuid("image_id").references(() => assets.id),
	...f.timestamps(),
});

export type Person = typeof persons.$inferSelect;
export type PersonInput = typeof persons.$inferInsert;

export const PersonSelectSchema = createSelectSchema(persons);
export const PersonInsertSchema = createInsertSchema(persons);
export const PersonUpdateSchema = createUpdateSchema(persons);

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
