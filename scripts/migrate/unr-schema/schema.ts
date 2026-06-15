// oxlint-disable no-use-before-define

import { sql } from "drizzle-orm";
import {
	boolean,
	customType,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const bodyType = pgEnum("body_type", ["bod", "dco", "ga", "jrc", "ncc", "sb", "smt"]);
export const countryType = pgEnum("country_type", [
	"cooperating_partnership",
	"member_country",
	"other",
]);
export const eventSize = pgEnum("event_size", [
	"dariah_commissioned",
	"large",
	"medium",
	"small",
	"very_large",
]);
export const institutionServiceRole = pgEnum("institution_service_role", [
	"content_provider",
	"service_owner",
	"service_provider",
	"technical_contact",
]);
export const institutionType = pgEnum("institution_type", [
	"cooperating_partner",
	"national_coordinating_institution",
	"national_representative_institution",
	"other",
	"partner_institution",
]);
export const outreachKpiType = pgEnum("outreach_kpi_type", [
	"engagement",
	"followers",
	"impressions",
	"mention",
	"new_content",
	"page_views",
	"posts",
	"reach",
	"subscribers",
	"unique_visitors",
	"views",
	"watch_time",
]);
export const outreachType = pgEnum("outreach_type", [
	"national_website",
	"social_media",
	"national_social_media",
]);
export const projectScope = pgEnum("project_scope", ["eu", "national", "regional"]);
export const reportCampaignStatus = pgEnum("report_campaign_status", ["in_progress", "done"]);
export const reportStatus = pgEnum("report_status", ["draft", "final"]);
export const researchPolicyLevel = pgEnum("research_policy_level", [
	"eu",
	"international",
	"institutional",
	"national",
	"regional",
]);
export const roleType = pgEnum("role_type", [
	"dco_member",
	"director",
	"national_coordinator",
	"national_coordinator_deputy",
	"national_representative",
	"jrc_member",
	"scientific_board_member",
	"smt_member",
	"wg_chair",
	"wg_member",
	"national_representative_deputy",
	"national_consortium_contact",
	"cooperating_partner_contact",
	"jrc_chair",
	"ncc_chair",
]);
export const serviceAudience = pgEnum("service_audience", [
	"dariah_team",
	"global",
	"national_local",
]);
export const serviceKpiType = pgEnum("service_kpi_type", [
	"downloads",
	"hits",
	"items",
	"jobs_processed",
	"page_views",
	"registered_users",
	"searches",
	"sessions",
	"unique_users",
	"visits",
	"websites_hosted",
]);
export const serviceMarketplaceStatus = pgEnum("service_marketplace_status", [
	"no",
	"not_applicable",
	"yes",
]);
export const serviceSize = pgEnum("service_size", ["core", "large", "medium", "small"]);
export const serviceStatus = pgEnum("service_status", [
	"discontinued",
	"in_preparation",
	"live",
	"needs_review",
	"to_be_discontinued",
]);
export const serviceType = pgEnum("service_type", ["community", "core", "internal"]);
export const softwareMarketplaceStatus = pgEnum("software_marketplace_status", [
	"added_as_external_id",
	"added_as_item",
	"no",
	"not_applicable",
]);
export const softwareStatus = pgEnum("software_status", [
	"maintained",
	"needs_review",
	"not_maintained",
]);
export const userRole = pgEnum("user_role", ["admin", "contributor", "national_coordinator"]);
export const workingGroupEventRole = pgEnum("working_group_event_role", ["organiser", "presenter"]);
export const workingGroupOutreachType = pgEnum("working_group_outreach_type", [
	"website",
	"social_media",
]);

export const bodyToRole = pgTable(
	"_BodyToRole",
	{
		a: uuid("A")
			.notNull()
			.references(() => bodies.id, { onDelete: "cascade", onUpdate: "cascade" }),
		b: uuid("B")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade", onUpdate: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.a, table.b], name: "_BodyToRole_AB_pkey" }),
		index("_BodyToRole_B_index").using("btree", table.b.asc().nullsLast()),
	],
);

export const countryToInstitution = pgTable(
	"_CountryToInstitution",
	{
		a: uuid("A")
			.notNull()
			.references(() => countries.id, { onDelete: "cascade", onUpdate: "cascade" }),
		b: uuid("B")
			.notNull()
			.references(() => institutions.id, { onDelete: "cascade", onUpdate: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.a, table.b], name: "_CountryToInstitution_AB_pkey" }),
		index("_CountryToInstitution_B_index").using("btree", table.b.asc().nullsLast()),
	],
);

export const countryToService = pgTable(
	"_CountryToService",
	{
		a: uuid("A")
			.notNull()
			.references(() => countries.id, { onDelete: "cascade", onUpdate: "cascade" }),
		b: uuid("B")
			.notNull()
			.references(() => services.id, { onDelete: "cascade", onUpdate: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.a, table.b], name: "_CountryToService_AB_pkey" }),
		index("_CountryToService_B_index").using("btree", table.b.asc().nullsLast()),
	],
);

export const countryToSoftware = pgTable(
	"_CountryToSoftware",
	{
		a: uuid("A")
			.notNull()
			.references(() => countries.id, { onDelete: "cascade", onUpdate: "cascade" }),
		b: uuid("B")
			.notNull()
			.references(() => software.id, { onDelete: "cascade", onUpdate: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.a, table.b], name: "_CountryToSoftware_AB_pkey" }),
		index("_CountryToSoftware_B_index").using("btree", table.b.asc().nullsLast()),
	],
);

export const institutionToPerson = pgTable(
	"_InstitutionToPerson",
	{
		a: uuid("A")
			.notNull()
			.references(() => institutions.id, { onDelete: "cascade", onUpdate: "cascade" }),
		b: uuid("B")
			.notNull()
			.references(() => persons.id, { onDelete: "cascade", onUpdate: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.a, table.b], name: "_InstitutionToPerson_AB_pkey" }),
		index("_InstitutionToPerson_B_index").using("btree", table.b.asc().nullsLast()),
	],
);

export const prismaMigrations = pgTable("_prisma_migrations", {
	id: varchar({ length: 36 }).primaryKey(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text(),
	rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
	startedAt: timestamp("started_at", { withTimezone: true })
		.default(sql`now()`)
		.notNull(),
	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});

export const bodies = pgTable("bodies", {
	id: uuid().primaryKey(),
	acronym: text(),
	name: text().notNull(),
	type: bodyType().notNull(),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	description: text(),
});

export const contributions = pgTable("contributions", {
	id: uuid().primaryKey(),
	endDate: timestamp("end_date", { precision: 3 }),
	startDate: timestamp("start_date", { precision: 3 }),
	countryId: uuid("country_id").references(() => countries.id, {
		onDelete: "set null",
		onUpdate: "cascade",
	}),
	personId: uuid("person_id")
		.notNull()
		.references(() => persons.id, { onDelete: "cascade", onUpdate: "cascade" }),
	roleId: uuid("role_id")
		.notNull()
		.references(() => roles.id, { onDelete: "cascade", onUpdate: "cascade" }),
	workingGroupId: uuid("working_group_id").references(() => workingGroups.id, {
		onDelete: "set null",
		onUpdate: "cascade",
	}),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export const countries = pgTable(
	"countries",
	{
		id: uuid().primaryKey(),
		code: text().notNull(),
		endDate: timestamp("end_date", { precision: 3 }),
		logo: text(),
		marketplaceId: integer("marketplace_id"),
		name: text().notNull(),
		startDate: timestamp("start_date", { precision: 3 }),
		type: countryType().notNull(),
		createdAt: timestamp("created_at", { precision: 3 })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		description: text(),
		consortiumName: text("consortium_name"),
	},
	(table) => [index("countries_code_idx").using("btree", table.code.asc().nullsLast())],
);

export const eventReports = pgTable(
	"event_reports",
	{
		id: uuid().primaryKey(),
		dariahCommissionedEvent: text("dariah_commissioned_event"),
		largeMeetings: integer("large_meetings"),
		mediumMeetings: integer("medium_meetings"),
		reusableOutcomes: text("reusable_outcomes"),
		smallMeetings: integer("small_meetings"),
		reportId: uuid("report_id")
			.notNull()
			.references(() => reports.id, { onDelete: "cascade", onUpdate: "cascade" }),
		createdAt: timestamp("created_at", { precision: 3 })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		veryLargeMeetings: integer("very_large_meetings"),
	},
	(table) => [
		uniqueIndex("event_reports_report_id_key").using("btree", table.reportId.asc().nullsLast()),
	],
);

export const eventSizeValues = pgTable(
	"event_size_values",
	{
		id: uuid().primaryKey(),
		annualValue: integer("annual_value").notNull(),
		type: eventSize().notNull(),
		createdAt: timestamp("created_at", { precision: 3 })
			.default(sql`now()`)
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		reportCampaignId: uuid("report_campaign_id")
			.notNull()
			.references(() => reportCampaigns.id, { onDelete: "restrict", onUpdate: "cascade" }),
	},
	(table) => [
		uniqueIndex("event_size_values_report_campaign_id_type_key").using(
			"btree",
			table.reportCampaignId.asc().nullsLast(),
			table.type.asc().nullsLast(),
		),
	],
);

export const institutionService = pgTable(
	"institution_service",
	{
		role: institutionServiceRole().notNull(),
		institutionId: uuid("institution_id")
			.notNull()
			.references(() => institutions.id, { onDelete: "cascade", onUpdate: "cascade" }),
		serviceId: uuid("service_id")
			.notNull()
			.references(() => services.id, { onDelete: "cascade", onUpdate: "cascade" }),
	},
	(table) => [
		uniqueIndex("institution_service_institution_id_role_service_id_key").using(
			"btree",
			table.institutionId.asc().nullsLast(),
			table.role.asc().nullsLast(),
			table.serviceId.asc().nullsLast(),
		),
	],
);

export const institutions = pgTable("institutions", {
	id: uuid().primaryKey(),
	endDate: timestamp("end_date", { precision: 3 }),
	name: text().notNull(),
	ror: text(),
	startDate: timestamp("start_date", { precision: 3 }),
	types: institutionType().array(),
	url: text().array(),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export const outreach = pgTable("outreach", {
	id: uuid().primaryKey(),
	endDate: timestamp("end_date", { precision: 3 }),
	name: text().notNull(),
	startDate: timestamp("start_date", { precision: 3 }),
	type: outreachType().notNull(),
	url: text().notNull(),
	countryId: uuid("country_id").references(() => countries.id, {
		onDelete: "cascade",
		onUpdate: "cascade",
	}),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export const outreachKpis = pgTable("outreach_kpis", {
	id: uuid().primaryKey(),
	unit: outreachKpiType().notNull(),
	value: integer().notNull(),
	outreachReportId: uuid("outreach_report_id")
		.notNull()
		.references(() => outreachReports.id, { onDelete: "cascade", onUpdate: "cascade" }),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export const outreachReports = pgTable("outreach_reports", {
	id: uuid().primaryKey(),
	outreachId: uuid("outreach_id")
		.notNull()
		.references(() => outreach.id, { onDelete: "cascade", onUpdate: "cascade" }),
	reportId: uuid("report_id")
		.notNull()
		.references(() => reports.id, { onDelete: "cascade", onUpdate: "cascade" }),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export const outreachTypeValues = pgTable(
	"outreach_type_values",
	{
		id: uuid().primaryKey(),
		annualValue: integer("annual_value").notNull(),
		type: outreachType().notNull(),
		createdAt: timestamp("created_at", { precision: 3 })
			.default(sql`now()`)
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		reportCampaignId: uuid("report_campaign_id")
			.notNull()
			.references(() => reportCampaigns.id, { onDelete: "restrict", onUpdate: "cascade" }),
	},
	(table) => [
		uniqueIndex("outreach_type_values_report_campaign_id_type_key").using(
			"btree",
			table.reportCampaignId.asc().nullsLast(),
			table.type.asc().nullsLast(),
		),
	],
);

export const persons = pgTable("persons", {
	id: uuid().primaryKey(),
	email: text(),
	name: text().notNull(),
	orcid: text(),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	description: text(),
	image: text(),
});

export const projectMetadata = pgTable("project_metadata", {
	id: uuid().primaryKey(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	logo: text(),
	slug: text(),
});

export const projects = pgTable("projects", {
	id: uuid().primaryKey(),
	amount: numeric({ precision: 12, scale: 2 }),
	funders: text(),
	name: text().notNull(),
	projectMonths: integer("project_months"),
	scope: projectScope(),
	startDate: timestamp("start_date", { precision: 3 }),
	totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
	reportId: uuid("report_id")
		.notNull()
		.references(() => reports.id, { onDelete: "cascade", onUpdate: "cascade" }),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	acronym: text(),
});

export const reportCampaigns = pgTable(
	"report_campaigns",
	{
		id: uuid().primaryKey(),
		serviceSizeThresholds: jsonb("service_size_thresholds").notNull(),
		status: reportCampaignStatus().default("in_progress").notNull(),
		year: integer().notNull(),
		createdAt: timestamp("created_at", { precision: 3 })
			.default(sql`now()`)
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		facultativeQuestionsListTemplate: jsonb("facultative_questions_list_template"),
		narrativeQuestionsListTemplate: jsonb("narrative_questions_list_template"),
	},
	(table) => [
		index("report_campaigns_year_idx").using("btree", table.year.asc().nullsLast()),
		uniqueIndex("report_campaigns_year_key").using("btree", table.year.asc().nullsLast()),
	],
);

export const reports = pgTable(
	"reports",
	{
		id: uuid().primaryKey(),
		comments: jsonb(),
		contributionsCount: integer("contributions_count"),
		operationalCost: numeric("operational_cost", { precision: 12, scale: 2 }),
		operationalCostDetail: jsonb("operational_cost_detail"),
		operationalCostThreshold: numeric("operational_cost_threshold", { precision: 12, scale: 2 }),
		status: reportStatus().default("draft").notNull(),
		countryId: uuid("country_id")
			.notNull()
			.references(() => countries.id, { onDelete: "cascade", onUpdate: "cascade" }),
		createdAt: timestamp("created_at", { precision: 3 })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		reportCampaignId: uuid("report_campaign_id")
			.notNull()
			.references(() => reportCampaigns.id, { onDelete: "restrict", onUpdate: "cascade" }),
	},
	(table) => [
		uniqueIndex("reports_report_campaign_id_country_id_key").using(
			"btree",
			table.reportCampaignId.asc().nullsLast(),
			table.countryId.asc().nullsLast(),
		),
		index("reports_report_campaign_id_idx").using(
			"btree",
			table.reportCampaignId.asc().nullsLast(),
		),
	],
);

export const researchPolicyDevelopments = pgTable("research_policy_developments", {
	id: uuid().primaryKey(),
	level: researchPolicyLevel().notNull(),
	name: text().notNull(),
	outcome: text(),
	reportId: uuid("report_id")
		.notNull()
		.references(() => reports.id, { onDelete: "cascade", onUpdate: "cascade" }),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export const roleTypeValues = pgTable(
	"role_type_values",
	{
		id: uuid().primaryKey(),
		annualValue: integer("annual_value").notNull(),
		type: roleType().notNull(),
		reportCampaignId: uuid("report_campaign_id")
			.notNull()
			.references(() => reportCampaigns.id, { onDelete: "restrict", onUpdate: "cascade" }),
		createdAt: timestamp("created_at", { precision: 3 })
			.default(sql`now()`)
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	},
	(table) => [
		uniqueIndex("role_type_values_report_campaign_id_type_key").using(
			"btree",
			table.reportCampaignId.asc().nullsLast(),
			table.type.asc().nullsLast(),
		),
	],
);

export const roles = pgTable("roles", {
	id: uuid().primaryKey(),
	name: text().notNull(),
	type: roleType().notNull(),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export const serviceKpis = pgTable("service_kpis", {
	id: uuid().primaryKey(),
	unit: serviceKpiType().notNull(),
	value: integer().notNull(),
	serviceReportId: uuid("service_report_id")
		.notNull()
		.references(() => serviceReports.id, { onDelete: "cascade", onUpdate: "cascade" }),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export const serviceReports = pgTable("service_reports", {
	id: uuid().primaryKey(),
	reportId: uuid("report_id")
		.notNull()
		.references(() => reports.id, { onDelete: "cascade", onUpdate: "cascade" }),
	serviceId: uuid("service_id")
		.notNull()
		.references(() => services.id, { onDelete: "cascade", onUpdate: "cascade" }),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export const serviceSizeValues = pgTable(
	"service_size_values",
	{
		id: uuid().primaryKey(),
		annualValue: integer("annual_value").notNull(),
		type: serviceSize().notNull(),
		createdAt: timestamp("created_at", { precision: 3 })
			.default(sql`now()`)
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		reportCampaignId: uuid("report_campaign_id")
			.notNull()
			.references(() => reportCampaigns.id, { onDelete: "restrict", onUpdate: "cascade" }),
	},
	(table) => [
		uniqueIndex("service_size_values_report_campaign_id_type_key").using(
			"btree",
			table.reportCampaignId.asc().nullsLast(),
			table.type.asc().nullsLast(),
		),
	],
);

export const services = pgTable("services", {
	id: uuid().primaryKey(),
	agreements: text(),
	audience: serviceAudience(),
	dariahBranding: boolean("dariah_branding"),
	eoscOnboarding: boolean("eosc_onboarding"),
	marketplaceStatus: serviceMarketplaceStatus("marketplace_status"),
	marketplaceId: text("marketplace_id"),
	monitoring: boolean(),
	name: text().notNull(),
	privateSupplier: boolean("private_supplier"),
	status: serviceStatus(),
	technicalContact: text("technical_contact"),
	technicalReadinessLevel: integer("technical_readiness_level"),
	type: serviceType(),
	url: text().array(),
	valueProposition: text("value_proposition"),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	comment: text(),
});

export const sessions = pgTable("sessions", {
	id: text().primaryKey(),
	secretHash: customType({
		dataType() {
			return "bytea";
		},
	})("secret_hash").notNull(),
	createdAt: timestamp("created_at", { precision: 3 }).notNull(),
	lastVerifiedAt: timestamp("last_verified_at", { precision: 3 }).notNull(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const software = pgTable("software", {
	id: uuid().primaryKey(),
	comment: text(),
	name: text().notNull(),
	marketplaceStatus: softwareMarketplaceStatus("marketplace_status"),
	marketplaceId: text("marketplace_id"),
	status: softwareStatus(),
	url: text().array(),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
});

export const users = pgTable(
	"users",
	{
		id: uuid().primaryKey(),
		email: text().notNull(),
		name: text().notNull(),
		password: text().notNull(),
		role: userRole().default("contributor").notNull(),
		countryId: uuid("country_id").references(() => countries.id, {
			onDelete: "set null",
			onUpdate: "cascade",
		}),
		personId: uuid("person_id").references(() => persons.id, {
			onDelete: "set null",
			onUpdate: "cascade",
		}),
	},
	(table) => [uniqueIndex("users_email_key").using("btree", table.email.asc().nullsLast())],
);

export const workingGroupEvents = pgTable("working_group_events", {
	id: uuid().primaryKey(),
	date: timestamp({ precision: 3 }),
	role: workingGroupEventRole().notNull(),
	title: text().notNull(),
	url: text().notNull(),
	reportId: uuid("report_id")
		.notNull()
		.references(() => workingGroupReports.id, { onDelete: "restrict", onUpdate: "cascade" }),
});

export const workingGroupOutreach = pgTable("working_group_outreach", {
	id: uuid().primaryKey(),
	endDate: timestamp("end_date", { precision: 3 }),
	name: text().notNull(),
	startDate: timestamp("start_date", { precision: 3 }),
	url: text().notNull(),
	workingGroupId: uuid("working_group_id")
		.notNull()
		.references(() => workingGroups.id, { onDelete: "restrict", onUpdate: "cascade" }),
	createdAt: timestamp("created_at", { precision: 3 })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
	type: workingGroupOutreachType().notNull(),
});

export const workingGroupReports = pgTable(
	"working_group_reports",
	{
		id: uuid().primaryKey(),
		comments: jsonb(),
		members: integer(),
		status: reportStatus().default("draft").notNull(),
		workingGroupId: uuid("working_group_id")
			.notNull()
			.references(
				// oxlint-disable-next-line no-use-before-define
				() => workingGroups.id,
				{ onDelete: "restrict", onUpdate: "cascade" },
			),
		createdAt: timestamp("created_at", { precision: 3 })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		reportCampaignId: uuid("report_campaign_id")
			.notNull()
			.references(() => reportCampaigns.id, { onDelete: "restrict", onUpdate: "cascade" }),
		facultativeQuestionsList: jsonb("facultative_questions_list"),
		narrativeQuestionsList: jsonb("narrative_questions_list"),
	},
	(table) => [
		index("working_group_reports_report_campaign_id_idx").using(
			"btree",
			table.reportCampaignId.asc().nullsLast(),
		),
		uniqueIndex("working_group_reports_report_campaign_id_working_group_id_key").using(
			"btree",
			table.reportCampaignId.asc().nullsLast(),
			table.workingGroupId.asc().nullsLast(),
		),
	],
);

export const workingGroups = pgTable(
	"working_groups",
	{
		id: uuid().primaryKey(),
		endDate: timestamp("end_date", { precision: 3 }),
		name: text().notNull(),
		startDate: timestamp("start_date", { precision: 3 }),
		createdAt: timestamp("created_at", { precision: 3 })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp("updated_at", { precision: 3 }).notNull(),
		mailingList: text("mailing_list"),
		memberTracking: text("member_tracking"),
		contactEmail: text("contact_email"),
		slug: text().notNull(),
		marketplaceId: integer("marketplace_id"),
		description: text(),
		logo: text(),
	},
	(table) => [index("working_groups_slug_idx").using("btree", table.slug.asc().nullsLast())],
);
