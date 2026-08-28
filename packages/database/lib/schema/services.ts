import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { entities } from "./entities";
import { socialMedia } from "./social-media";

export const serviceTypesEnum = ["community", "core", "internal"] as const;

export const serviceTypes = p.snakeCase.table(
	"service_types",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		type: p.text("type", { enum: serviceTypesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [p.check("service_types_type_enum_check", inArray(t.type, serviceTypesEnum))],
);

export type ServiceType = typeof serviceTypes.$inferSelect;
export type ServiceTypeInput = typeof serviceTypes.$inferInsert;

export const ServiceTypeSelectSchema = createSelectSchema(serviceTypes);
export const ServiceTypeInsertSchema = createInsertSchema(serviceTypes);
export const ServiceTypeUpdateSchema = createUpdateSchema(serviceTypes);

/**
 * When services are ingested from sshoc marketplace, they default to "live". All other statuses are
 * managed in the dariah knowledge base. Upon re-ingest from sshoc marketplace, the status field is
 * not updated. When a service is no longer included in the sshoc marketplace response (e.g. because
 * it has been deprecated there), its status is set to "needs_review" if its current status is still
 * set to "live". In other cases, the status field is not updated.
 */
export const serviceStatusesEnum = [
	"discontinued",
	"live",
	"needs_review",
	"to_be_discontinued",
] as const;

export const serviceStatuses = p.snakeCase.table(
	"service_statuses",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		status: p.text("status", { enum: serviceStatusesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [p.check("service_statuses_status_enum_check", inArray(t.status, serviceStatusesEnum))],
);

export type ServiceStatus = typeof serviceStatuses.$inferSelect;
export type ServiceStatusInput = typeof serviceStatuses.$inferInsert;

export const ServiceStatusSelectSchema = createSelectSchema(serviceStatuses);
export const ServiceStatusInsertSchema = createInsertSchema(serviceStatuses);
export const ServiceStatusUpdateSchema = createUpdateSchema(serviceStatuses);

export const services = p.snakeCase.table("services", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	name: p.text("name").notNull(),
	sshocMarketplaceId: p.text("sshoc_marketplace_id").unique(),
	typeId: p
		.uuid("type_id")
		.notNull()
		.references(() => serviceTypes.id),
	statusId: p
		.uuid("status_id")
		.notNull()
		.references(() => serviceStatuses.id),
	comment: p.text("comment"),
	dariahBranding: p.boolean("dariah_branding"),
	monitoring: p.boolean("monitoring"),
	privateSupplier: p.boolean("private_supplier"),
	metadata: p.jsonb("metadata"),
	...f.timestamps(),
});

export type Service = typeof services.$inferSelect;
export type ServiceInput = typeof services.$inferInsert;

export const ServiceSelectSchema = createSelectSchema(services);
export const ServiceInsertSchema = createInsertSchema(services);
export const ServiceUpdateSchema = createUpdateSchema(services);

/**
 * These are derived from the contributor role (of the actor/organisational unit) in sshoc
 * marketplace:
 *
 * "reviewer" => "service_owner" "provider" => "service_provider" "curator" is always DARIAH-EU but
 * this is not reflected in our data model
 */
export const organisationalUnitServiceRolesEnum = ["service_owner", "service_provider"] as const;

export const organisationalUnitServiceRoles = p.snakeCase.table(
	"organisational_unit_service_roles",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		role: p.text("role", { enum: organisationalUnitServiceRolesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"service_statuses_status_enum_check",
			inArray(t.role, organisationalUnitServiceRolesEnum),
		),
	],
);

export type OrganisationalUnitServiceRole = typeof organisationalUnitServiceRoles.$inferSelect;
export type OrganisationalUnitServiceRoleInput = typeof organisationalUnitServiceRoles.$inferInsert;

export const OrganisationalUnitServiceRoleSelectSchema = createSelectSchema(
	organisationalUnitServiceRoles,
);
export const OrganisationalUnitServiceRoleInsertSchema = createInsertSchema(
	organisationalUnitServiceRoles,
);
export const OrganisationalUnitServiceRoleUpdateSchema = createUpdateSchema(
	organisationalUnitServiceRoles,
);

/**
 * Services are not versioned entities (their `id` is a standalone key), so `serviceId` is stable.
 * The organisational-unit endpoint, however, is a versioned entity: it references `entities.id` (a
 * document id), not a version id, so the relation stays valid across the unit's draft/publish
 * lifecycle. Reads resolve the unit endpoint to its published version.
 *
 * Ownership of a row depends on its service: for a service with an `sshocMarketplaceId` the
 * marketplace is the source of truth and the ingest reconciles the full set on every run (relations
 * it does not see are deleted); for a local service the admin service form owns the set.
 */
export const servicesToOrganisationalUnits = p.snakeCase.table("services_to_organisational_units", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	serviceId: p
		.uuid("service_id")
		.notNull()
		.references(() => services.id),
	organisationalUnitDocumentId: p
		.uuid("organisational_unit_document_id")
		.notNull()
		.references(() => entities.id),
	roleId: p
		.uuid("role_id")
		.notNull()
		.references(() => organisationalUnitServiceRoles.id),
	...f.timestamps(),
});

export type ServiceToOrganisationalUnit = typeof servicesToOrganisationalUnits.$inferSelect;
export type ServiceToOrganisationalUnitInput = typeof servicesToOrganisationalUnits.$inferInsert;

export const ServiceToOrganisationalUnitSelectSchema = createSelectSchema(
	servicesToOrganisationalUnits,
);
export const ServiceToOrganisationalUnitInsertSchema = createInsertSchema(
	servicesToOrganisationalUnits,
);
export const ServiceToOrganisationalUnitUpdateSchema = createUpdateSchema(
	servicesToOrganisationalUnits,
);

export const servicesToSocialMedia = p.snakeCase.table("services_to_social_media", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	serviceId: p
		.uuid("service_id")
		.notNull()
		.references(() => services.id),
	socialMediaId: p
		.uuid("social_media_id")
		.notNull()
		.references(() => socialMedia.id),
	...f.timestamps(),
});

export type ServiceToSocialMedia = typeof servicesToSocialMedia.$inferSelect;
export type ServiceToSocialMediaInput = typeof servicesToSocialMedia.$inferInsert;

export const ServiceToSocialMediaSelectSchema = createSelectSchema(servicesToSocialMedia);
export const ServiceToSocialMediaInsertSchema = createInsertSchema(servicesToSocialMedia);
export const ServiceToSocialMediaUpdateSchema = createUpdateSchema(servicesToSocialMedia);
