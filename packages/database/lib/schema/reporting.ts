import type { JSONContent } from "@tiptap/core";
import { inArray, sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { entities } from "./entities";
import { personsToOrganisationalUnits } from "./persons";
import { services } from "./services";
import { socialMedia } from "./social-media";
import { users } from "./users";

export const reportingCampaignStatusEnum = ["draft", "open", "closed"] as const;

export const reportingCampaigns = p.snakeCase.table(
	"reporting_campaigns",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		year: p.integer("year").notNull().unique(),
		status: p.text("status", { enum: reportingCampaignStatusEnum }).notNull().default("draft"),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"reporting_campaigns_status_enum_check",
			inArray(t.status, reportingCampaignStatusEnum),
		),
	],
);

export type ReportingCampaign = typeof reportingCampaigns.$inferSelect;
export type ReportingCampaignInput = typeof reportingCampaigns.$inferInsert;

export const ReportingCampaignSelectSchema = createSelectSchema(reportingCampaigns);
export const ReportingCampaignInsertSchema = createInsertSchema(reportingCampaigns);
export const ReportingCampaignUpdateSchema = createUpdateSchema(reportingCampaigns);

export const reportStatusEnum = ["draft", "submitted", "accepted"] as const;

/**
 * The institution↔ERIC representation relation captured per country-report institution. A subset of
 * the `institution -> eric` representation statuses: only member/observer countries file reports,
 * so `is_cooperating_partner_of` is deliberately excluded. A frozen snapshot of the role at capture
 * time.
 */
export const countryReportInstitutionRepresentationEnum = [
	"is_national_coordinating_institution_in",
	"is_national_representative_institution_in",
	"is_partner_institution_of",
] as const;

/**
 * The compensated contribution roles. Each carries a per-campaign € amount ({@link
 * reportingCampaignContributionAmounts}); a country report's contributions are classified into
 * these (coordinator/deputy are snapshotted from relations, the rest claimed manually).
 */
export const reportingCampaignContributionRoleEnum = [
	"national_coordinator",
	"national_coordinator_deputy",
	"is_chair_of_jrc",
	"is_chair_of_ncc",
	"is_chair_of_wg",
	"is_member_of_jrc",
] as const;

export const reportScreenCommentTypeEnum = ["country", "working_group"] as const;
export const reportScreenCommentKeyEnum = [
	"institutions",
	"contributors",
	"events",
	"social-media",
	"services",
	"software",
	"publications",
	"projects",
	"data",
	"questions",
	"confirm",
] as const;

export const countryReports = p.snakeCase.table(
	"country_reports",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		campaignId: p
			.uuid("campaign_id")
			.notNull()
			.references(() => reportingCampaigns.id),
		// Document-level: references the country's `entities.id`, not a version id, so the report's
		// identity is stable across the country's draft/publish lifecycle.
		countryDocumentId: p
			.uuid("country_document_id")
			.notNull()
			.references(() => entities.id),
		status: p.text("status", { enum: reportStatusEnum }).notNull().default("draft"),
		totalContributors: p.integer("total_contributors"),
		smallEvents: p.integer("small_events"),
		mediumEvents: p.integer("medium_events"),
		largeEvents: p.integer("large_events"),
		veryLargeEvents: p.integer("very_large_events"),
		dariahCommissionedEvent: p.text("dariah_commissioned_event"),
		reusableOutcomes: p.text("reusable_outcomes"),
		...f.timestamps(),
	},
	(t) => [
		p
			.unique("country_reports_campaign_id_country_document_id_unique")
			.on(t.campaignId, t.countryDocumentId),
		p.check("country_reports_status_enum_check", inArray(t.status, reportStatusEnum)),
	],
);

export type CountryReport = typeof countryReports.$inferSelect;
export type CountryReportInput = typeof countryReports.$inferInsert;

export const CountryReportSelectSchema = createSelectSchema(countryReports);
export const CountryReportInsertSchema = createInsertSchema(countryReports);
export const CountryReportUpdateSchema = createUpdateSchema(countryReports);

export const workingGroupReports = p.snakeCase.table(
	"working_group_reports",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		campaignId: p
			.uuid("campaign_id")
			.notNull()
			.references(() => reportingCampaigns.id),
		// Document-level: references the working group's `entities.id`, not a version id.
		workingGroupDocumentId: p
			.uuid("working_group_document_id")
			.notNull()
			.references(() => entities.id),
		status: p.text("status", { enum: reportStatusEnum }).notNull().default("draft"),
		numberOfMembers: p.integer("number_of_members"),
		...f.timestamps(),
	},
	(t) => [
		p
			.unique("working_group_reports_campaign_wg_document_unique")
			.on(t.campaignId, t.workingGroupDocumentId),
		p.check("working_group_reports_status_enum_check", inArray(t.status, reportStatusEnum)),
	],
);

export type WorkingGroupReport = typeof workingGroupReports.$inferSelect;
export type WorkingGroupReportInput = typeof workingGroupReports.$inferInsert;

export const WorkingGroupReportSelectSchema = createSelectSchema(workingGroupReports);
export const WorkingGroupReportInsertSchema = createInsertSchema(workingGroupReports);
export const WorkingGroupReportUpdateSchema = createUpdateSchema(workingGroupReports);

export const reportExternalResourceSnapshotSectionEnum = [
	"country_sshoc_resources",
	"country_zotero_publications",
	"working_group_sshoc_resources",
	"working_group_zotero_publications",
] as const;

/**
 * A frozen per-report snapshot of externally indexed SSHOC/Zotero resources. The external search
 * query can be refreshed while a report is editable; submitted/accepted reports render this stored
 * snapshot rather than live search-index state.
 */
export const reportExternalResourceSnapshots = p.snakeCase.table(
	"report_external_resource_snapshots",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		countryReportId: p.uuid("country_report_id").references(() => countryReports.id),
		workingGroupReportId: p
			.uuid("working_group_report_id")
			.references(() => workingGroupReports.id),
		section: p.text("section", { enum: reportExternalResourceSnapshotSectionEnum }).notNull(),
		filterBy: p.text("filter_by").notNull(),
		actorSlugs: p.jsonb("actor_slugs").$type<Array<string>>().notNull(),
		capturedAt: f.timestamp("captured_at").notNull().defaultNow(),
		capturedByUserId: p.uuid("captured_by_user_id").references(() => users.id),
		...f.timestamps(),
	},
	(t) => [
		p
			.unique("report_external_resource_snapshots_country_report_section_unique")
			.on(t.countryReportId, t.section),
		p
			.unique("report_external_resource_snapshots_working_group_report_section_unique")
			.on(t.workingGroupReportId, t.section),
		p.check(
			"report_external_resource_snapshots_section_enum_check",
			inArray(t.section, reportExternalResourceSnapshotSectionEnum),
		),
		p.check(
			"report_external_resource_snapshots_report_owner_xor_check",
			sql`
				(
					CASE WHEN ${t.countryReportId} IS NULL THEN 0 ELSE 1 END
					+ CASE WHEN ${t.workingGroupReportId} IS NULL THEN 0 ELSE 1 END
				) = 1
			`,
		),
	],
);

export type ReportExternalResourceSnapshot = typeof reportExternalResourceSnapshots.$inferSelect;
export type ReportExternalResourceSnapshotInput =
	typeof reportExternalResourceSnapshots.$inferInsert;

export const ReportExternalResourceSnapshotSelectSchema = createSelectSchema(
	reportExternalResourceSnapshots,
);
export const ReportExternalResourceSnapshotInsertSchema = createInsertSchema(
	reportExternalResourceSnapshots,
);
export const ReportExternalResourceSnapshotUpdateSchema = createUpdateSchema(
	reportExternalResourceSnapshots,
);

export const reportExternalResourceSnapshotItems = p.snakeCase.table(
	"report_external_resource_snapshot_items",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		snapshotId: p
			.uuid("snapshot_id")
			.notNull()
			.references(() => reportExternalResourceSnapshots.id, { onDelete: "cascade" }),
		position: p.integer("position").notNull(),
		searchDocumentId: p.text("search_document_id").notNull(),
		source: p.text("source").notNull(),
		sourceId: p.text("source_id").notNull(),
		sourceUpdatedAt: p.bigint("source_updated_at", { mode: "number" }),
		importedAt: p.bigint("imported_at", { mode: "number" }).notNull(),
		type: p.text("type").notNull(),
		sshocCategory: p.text("sshoc_category"),
		label: p.text("label").notNull(),
		description: p.text("description").notNull(),
		keywords: p.jsonb("keywords").$type<Array<string>>().notNull(),
		kind: p.text("kind"),
		sourceUrl: p.text("source_url"),
		links: p.jsonb("links").$type<Array<string>>().notNull(),
		authors: p.jsonb("authors").$type<Array<string>>(),
		year: p.integer("year"),
		pid: p.text("pid"),
	},
	(t) => [
		p
			.unique("report_external_resource_snapshot_items_snapshot_document_unique")
			.on(t.snapshotId, t.searchDocumentId),
		p
			.unique("report_external_resource_snapshot_items_snapshot_position_unique")
			.on(t.snapshotId, t.position),
	],
);

export type ReportExternalResourceSnapshotItem =
	typeof reportExternalResourceSnapshotItems.$inferSelect;
export type ReportExternalResourceSnapshotItemInput =
	typeof reportExternalResourceSnapshotItems.$inferInsert;

export const ReportExternalResourceSnapshotItemSelectSchema = createSelectSchema(
	reportExternalResourceSnapshotItems,
);
export const ReportExternalResourceSnapshotItemInsertSchema = createInsertSchema(
	reportExternalResourceSnapshotItems,
);
export const ReportExternalResourceSnapshotItemUpdateSchema = createUpdateSchema(
	reportExternalResourceSnapshotItems,
);

export const reportScreenComments = p.snakeCase.table(
	"report_screen_comments",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		reportType: p.text("report_type", { enum: reportScreenCommentTypeEnum }).notNull(),
		reportId: p.uuid("report_id").notNull(),
		screenKey: p.text("screen_key", { enum: reportScreenCommentKeyEnum }).notNull(),
		comment: p.jsonb("comment").$type<JSONContent>(),
		...f.timestamps(),
	},
	(t) => [
		p
			.unique("report_screen_comments_report_type_report_id_screen_key_unique")
			.on(t.reportType, t.reportId, t.screenKey),
		p.check(
			"report_screen_comments_report_type_enum_check",
			inArray(t.reportType, reportScreenCommentTypeEnum),
		),
		p.check(
			"report_screen_comments_screen_key_enum_check",
			inArray(t.screenKey, reportScreenCommentKeyEnum),
		),
	],
);

export type ReportScreenComment = typeof reportScreenComments.$inferSelect;
export type ReportScreenCommentInput = typeof reportScreenComments.$inferInsert;

export const ReportScreenCommentSelectSchema = createSelectSchema(reportScreenComments);
export const ReportScreenCommentInsertSchema = createInsertSchema(reportScreenComments);
export const ReportScreenCommentUpdateSchema = createUpdateSchema(reportScreenComments);

export const countryReportContributions = p.snakeCase.table(
	"country_report_contributions",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		countryReportId: p
			.uuid("country_report_id")
			.notNull()
			.references(() => countryReports.id),
		personToOrgUnitId: p
			.uuid("person_to_org_unit_id")
			.notNull()
			.references(() => personsToOrganisationalUnits.id),
		// Frozen compensation role at capture/claim time (classified from the relation's role + org).
		// Nullable: legacy rows captured before this column existed stay null until re-captured.
		contributionRole: p.text("contribution_role", {
			enum: reportingCampaignContributionRoleEnum,
		}),
	},
	(t) => [
		p.unique().on(t.countryReportId, t.personToOrgUnitId),
		// A CHECK only fails on FALSE, so NULL (legacy rows) passes.
		p.check(
			"country_report_contributions_contribution_role_enum_check",
			inArray(t.contributionRole, reportingCampaignContributionRoleEnum),
		),
	],
);

export type CountryReportContribution = typeof countryReportContributions.$inferSelect;
export type CountryReportContributionInput = typeof countryReportContributions.$inferInsert;

export const CountryReportContributionSelectSchema = createSelectSchema(countryReportContributions);
export const CountryReportContributionInsertSchema = createInsertSchema(countryReportContributions);
export const CountryReportContributionUpdateSchema = createUpdateSchema(countryReportContributions);

export const socialMediaKpiCategoryEnum = [
	"engagement",
	"followers",
	"impressions",
	"mentions",
	"new_content",
	"page_views",
	"posts",
	"reach",
	"subscribers",
	"unique_visitors",
	"views",
	"watch_time",
] as const;

export const countryReportSocialMediaKpis = p.snakeCase.table(
	"country_report_social_media_kpis",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		countryReportId: p
			.uuid("country_report_id")
			.notNull()
			.references(() => countryReports.id),
		socialMediaId: p
			.uuid("social_media_id")
			.notNull()
			.references(() => socialMedia.id),
		kpi: p.text("kpi", { enum: socialMediaKpiCategoryEnum }).notNull(),
		value: p.integer("value").notNull(),
	},
	(t) => [
		p.unique().on(t.countryReportId, t.socialMediaId, t.kpi),
		p.check(
			"country_report_social_media_kpis_kpi_enum_check",
			inArray(t.kpi, socialMediaKpiCategoryEnum),
		),
	],
);

export type CountryReportSocialMediaKpi = typeof countryReportSocialMediaKpis.$inferSelect;
export type CountryReportSocialMediaKpiInput = typeof countryReportSocialMediaKpis.$inferInsert;

export const CountryReportSocialMediaKpiSelectSchema = createSelectSchema(
	countryReportSocialMediaKpis,
);
export const CountryReportSocialMediaKpiInsertSchema = createInsertSchema(
	countryReportSocialMediaKpis,
);
export const CountryReportSocialMediaKpiUpdateSchema = createUpdateSchema(
	countryReportSocialMediaKpis,
);

/**
 * The set of social media accounts a country report covers. Curated per report (carried over from
 * the previous year, then added to), rather than derived from the country org-unit's own accounts —
 * a country may report KPIs for a partner institution's account or a one-off event website. KPIs in
 * {@link countryReportSocialMediaKpis} hang off these (report, social media) pairs.
 */
export const countryReportSocialMedia = p.snakeCase.table(
	"country_report_social_media",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		countryReportId: p
			.uuid("country_report_id")
			.notNull()
			.references(() => countryReports.id),
		socialMediaId: p
			.uuid("social_media_id")
			.notNull()
			.references(() => socialMedia.id),
	},
	(t) => [p.unique().on(t.countryReportId, t.socialMediaId)],
);

export type CountryReportSocialMedia = typeof countryReportSocialMedia.$inferSelect;
export type CountryReportSocialMediaInput = typeof countryReportSocialMedia.$inferInsert;

export const CountryReportSocialMediaSelectSchema = createSelectSchema(countryReportSocialMedia);
export const CountryReportSocialMediaInsertSchema = createInsertSchema(countryReportSocialMedia);
export const CountryReportSocialMediaUpdateSchema = createUpdateSchema(countryReportSocialMedia);

export const serviceKpiCategoryEnum = [
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
] as const;

/**
 * The set of services a country report covers. Membership is snapshotted when the report is created
 * (current live consortium services plus live services from the previous year's report), then
 * curated independently of later consortium-relation changes. KPIs in
 * {@link countryReportServiceKpis} hang off these (report, service) pairs.
 */
export const countryReportServices = p.snakeCase.table(
	"country_report_services",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		countryReportId: p
			.uuid("country_report_id")
			.notNull()
			.references(() => countryReports.id),
		serviceId: p
			.uuid("service_id")
			.notNull()
			.references(() => services.id),
	},
	(t) => [p.unique().on(t.countryReportId, t.serviceId)],
);

export type CountryReportService = typeof countryReportServices.$inferSelect;
export type CountryReportServiceInput = typeof countryReportServices.$inferInsert;

export const CountryReportServiceSelectSchema = createSelectSchema(countryReportServices);
export const CountryReportServiceInsertSchema = createInsertSchema(countryReportServices);
export const CountryReportServiceUpdateSchema = createUpdateSchema(countryReportServices);

export const countryReportServiceKpis = p.snakeCase.table(
	"country_report_service_kpis",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		countryReportId: p
			.uuid("country_report_id")
			.notNull()
			.references(() => countryReports.id),
		serviceId: p
			.uuid("service_id")
			.notNull()
			.references(() => services.id),
		kpi: p.text("kpi", { enum: serviceKpiCategoryEnum }).notNull(),
		value: p.integer("value").notNull(),
	},
	(t) => [
		p.unique().on(t.countryReportId, t.serviceId, t.kpi),
		p.check("country_report_service_kpis_kpi_enum_check", inArray(t.kpi, serviceKpiCategoryEnum)),
	],
);

export type CountryReportServiceKpi = typeof countryReportServiceKpis.$inferSelect;
export type CountryReportServiceKpiInput = typeof countryReportServiceKpis.$inferInsert;

export const CountryReportServiceKpiSelectSchema = createSelectSchema(countryReportServiceKpis);
export const CountryReportServiceKpiInsertSchema = createInsertSchema(countryReportServiceKpis);
export const CountryReportServiceKpiUpdateSchema = createUpdateSchema(countryReportServiceKpis);

export const countryReportProjectContributions = p.snakeCase.table(
	"country_report_project_contributions",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		countryReportId: p
			.uuid("country_report_id")
			.notNull()
			.references(() => countryReports.id),
		// Document-level: references the project's `entities.id`, not a version id, so the contribution
		// stays attached to the project across its draft/publish lifecycle (resolved to the published
		// version at read time).
		projectDocumentId: p
			.uuid("project_document_id")
			.notNull()
			.references(() => entities.id),
		amountEuros: p.numeric("amount_euros", { mode: "number", precision: 12, scale: 2 }).notNull(),
	},
	(t) => [p.unique().on(t.countryReportId, t.projectDocumentId)],
);

export type CountryReportProjectContribution =
	typeof countryReportProjectContributions.$inferSelect;
export type CountryReportProjectContributionInput =
	typeof countryReportProjectContributions.$inferInsert;

export const CountryReportProjectContributionSelectSchema = createSelectSchema(
	countryReportProjectContributions,
);
export const CountryReportProjectContributionInsertSchema = createInsertSchema(
	countryReportProjectContributions,
);
export const CountryReportProjectContributionUpdateSchema = createUpdateSchema(
	countryReportProjectContributions,
);

export const countryReportInstitutions = p.snakeCase.table(
	"country_report_institutions",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		countryReportId: p
			.uuid("country_report_id")
			.notNull()
			.references(() => countryReports.id),
		// Document-level: references the institution's `entities.id`, not a version id.
		organisationalUnitDocumentId: p
			.uuid("organisational_unit_document_id")
			.notNull()
			.references(() => entities.id),
		// Frozen at capture time from the institution's `institution -> eric` representation relation.
		// Nullable: legacy rows captured before this column existed stay null until a refresh re-captures.
		representationType: p.text("representation_type", {
			enum: countryReportInstitutionRepresentationEnum,
		}),
	},
	(t) => [
		p
			.unique("country_report_institutions_report_unit_document_type_unique")
			.on(t.countryReportId, t.organisationalUnitDocumentId, t.representationType),
		// A CHECK only fails on FALSE, so NULL (legacy rows) passes.
		p.check(
			"country_report_institutions_representation_type_enum_check",
			inArray(t.representationType, countryReportInstitutionRepresentationEnum),
		),
	],
);

export type CountryReportInstitution = typeof countryReportInstitutions.$inferSelect;
export type CountryReportInstitutionInput = typeof countryReportInstitutions.$inferInsert;

export const CountryReportInstitutionSelectSchema = createSelectSchema(countryReportInstitutions);
export const CountryReportInstitutionInsertSchema = createInsertSchema(countryReportInstitutions);
export const CountryReportInstitutionUpdateSchema = createUpdateSchema(countryReportInstitutions);

export const workingGroupReportSocialMedia = p.snakeCase.table(
	"working_group_report_social_media",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		workingGroupReportId: p
			.uuid("working_group_report_id")
			.notNull()
			.references(() => workingGroupReports.id),
		socialMediaId: p
			.uuid("social_media_id")
			.notNull()
			.references(() => socialMedia.id),
	},
	(t) => [p.unique().on(t.workingGroupReportId, t.socialMediaId)],
);

export type WorkingGroupReportSocialMedia = typeof workingGroupReportSocialMedia.$inferSelect;
export type WorkingGroupReportSocialMediaInput = typeof workingGroupReportSocialMedia.$inferInsert;

export const WorkingGroupReportSocialMediaSelectSchema = createSelectSchema(
	workingGroupReportSocialMedia,
);
export const WorkingGroupReportSocialMediaInsertSchema = createInsertSchema(
	workingGroupReportSocialMedia,
);
export const WorkingGroupReportSocialMediaUpdateSchema = createUpdateSchema(
	workingGroupReportSocialMedia,
);

export const workingGroupReportChairRoleEnum = ["is_chair_of", "is_vice_chair_of"] as const;

/**
 * The chair relations captured for a working-group report. The relation identifies the person and
 * working group; `chairRole` freezes the role at capture time so later relation edits do not change
 * the reported state.
 */
export const workingGroupReportChairs = p.snakeCase.table(
	"working_group_report_chairs",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		workingGroupReportId: p
			.uuid("working_group_report_id")
			.notNull()
			.references(() => workingGroupReports.id),
		personToOrgUnitId: p
			.uuid("person_to_org_unit_id")
			.notNull()
			.references(() => personsToOrganisationalUnits.id),
		chairRole: p.text("chair_role", { enum: workingGroupReportChairRoleEnum }).notNull(),
	},
	(t) => [
		p.unique().on(t.workingGroupReportId, t.personToOrgUnitId),
		p.check(
			"working_group_report_chairs_role_enum_check",
			inArray(t.chairRole, workingGroupReportChairRoleEnum),
		),
	],
);

export type WorkingGroupReportChair = typeof workingGroupReportChairs.$inferSelect;
export type WorkingGroupReportChairInput = typeof workingGroupReportChairs.$inferInsert;

export const WorkingGroupReportChairSelectSchema = createSelectSchema(workingGroupReportChairs);
export const WorkingGroupReportChairInsertSchema = createInsertSchema(workingGroupReportChairs);
export const WorkingGroupReportChairUpdateSchema = createUpdateSchema(workingGroupReportChairs);

export const workingGroupEventRoleEnum = ["organiser", "presenter"] as const;

export const workingGroupReportEvents = p.snakeCase.table("working_group_report_events", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	workingGroupReportId: p
		.uuid("working_group_report_id")
		.notNull()
		.references(() => workingGroupReports.id),
	title: p.text("title").notNull(),
	date: p.timestamp("date", { precision: 3 }).notNull(),
	url: p.text("url"),
	role: p.text("role", { enum: workingGroupEventRoleEnum }).notNull(),
});

export type WorkingGroupReportEvent = typeof workingGroupReportEvents.$inferSelect;
export type WorkingGroupReportEventInput = typeof workingGroupReportEvents.$inferInsert;

export const WorkingGroupReportEventSelectSchema = createSelectSchema(workingGroupReportEvents);
export const WorkingGroupReportEventInsertSchema = createInsertSchema(workingGroupReportEvents);
export const WorkingGroupReportEventUpdateSchema = createUpdateSchema(workingGroupReportEvents);

export const workingGroupReportQuestions = p.snakeCase.table(
	"working_group_report_questions",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		campaignId: p
			.uuid("campaign_id")
			.notNull()
			.references(() => reportingCampaigns.id),
		question: p.jsonb("question").$type<JSONContent>().notNull(),
		position: p.integer("position").notNull(),
	},
	(t) => [p.unique().on(t.campaignId, t.position)],
);

export type WorkingGroupReportQuestion = typeof workingGroupReportQuestions.$inferSelect;
export type WorkingGroupReportQuestionInput = typeof workingGroupReportQuestions.$inferInsert;

export const WorkingGroupReportQuestionSelectSchema = createSelectSchema(
	workingGroupReportQuestions,
);
export const WorkingGroupReportQuestionInsertSchema = createInsertSchema(
	workingGroupReportQuestions,
);
export const WorkingGroupReportQuestionUpdateSchema = createUpdateSchema(
	workingGroupReportQuestions,
);

export const workingGroupReportAnswers = p.snakeCase.table(
	"working_group_report_answers",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		workingGroupReportId: p
			.uuid("working_group_report_id")
			.notNull()
			.references(() => workingGroupReports.id),
		questionId: p
			.uuid("question_id")
			.notNull()
			.references(() => workingGroupReportQuestions.id),
		answer: p.jsonb("answer").$type<JSONContent>().notNull(),
	},
	(t) => [p.unique().on(t.workingGroupReportId, t.questionId)],
);

export type WorkingGroupReportAnswer = typeof workingGroupReportAnswers.$inferSelect;
export type WorkingGroupReportAnswerInput = typeof workingGroupReportAnswers.$inferInsert;

export const WorkingGroupReportAnswerSelectSchema = createSelectSchema(workingGroupReportAnswers);
export const WorkingGroupReportAnswerInsertSchema = createInsertSchema(workingGroupReportAnswers);

export const reportingCampaignEventTypeEnum = [
	"small",
	"medium",
	"large",
	"very_large",
	"dariah_commissioned",
] as const;

export const reportingCampaignEventAmounts = p.snakeCase.table(
	"reporting_campaign_event_amounts",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		campaignId: p
			.uuid("campaign_id")
			.notNull()
			.references(() => reportingCampaigns.id),
		eventType: p.text("event_type", { enum: reportingCampaignEventTypeEnum }).notNull(),
		amount: p.numeric("amount", { mode: "number", precision: 12, scale: 2 }).notNull(),
	},
	(t) => [
		p.unique().on(t.campaignId, t.eventType),
		p.check(
			"reporting_campaign_event_amounts_event_type_enum_check",
			inArray(t.eventType, reportingCampaignEventTypeEnum),
		),
	],
);

export type ReportingCampaignEventAmount = typeof reportingCampaignEventAmounts.$inferSelect;
export type ReportingCampaignEventAmountInput = typeof reportingCampaignEventAmounts.$inferInsert;

export const ReportingCampaignEventAmountSelectSchema = createSelectSchema(
	reportingCampaignEventAmounts,
);
export const ReportingCampaignEventAmountInsertSchema = createInsertSchema(
	reportingCampaignEventAmounts,
);

export const reportingCampaignSocialMediaCategoryEnum = ["website", "other"] as const;

export const reportingCampaignSocialMediaAmounts = p.snakeCase.table(
	"reporting_campaign_social_media_amounts",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		campaignId: p
			.uuid("campaign_id")
			.notNull()
			.references(() => reportingCampaigns.id),
		category: p.text("category", { enum: reportingCampaignSocialMediaCategoryEnum }).notNull(),
		amount: p.numeric("amount", { mode: "number", precision: 12, scale: 2 }).notNull(),
	},
	(t) => [
		p.unique().on(t.campaignId, t.category),
		p.check(
			"reporting_campaign_social_media_amounts_category_enum_check",
			inArray(t.category, reportingCampaignSocialMediaCategoryEnum),
		),
	],
);

export type ReportingCampaignSocialMediaAmount =
	typeof reportingCampaignSocialMediaAmounts.$inferSelect;
export type ReportingCampaignSocialMediaAmountInput =
	typeof reportingCampaignSocialMediaAmounts.$inferInsert;

export const ReportingCampaignSocialMediaAmountSelectSchema = createSelectSchema(
	reportingCampaignSocialMediaAmounts,
);
export const ReportingCampaignSocialMediaAmountInsertSchema = createInsertSchema(
	reportingCampaignSocialMediaAmounts,
);

export const reportingCampaignContributionAmounts = p.snakeCase.table(
	"reporting_campaign_contribution_amounts",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		campaignId: p
			.uuid("campaign_id")
			.notNull()
			.references(() => reportingCampaigns.id),
		roleType: p.text("role_type", { enum: reportingCampaignContributionRoleEnum }).notNull(),
		amount: p.numeric("amount", { mode: "number", precision: 12, scale: 2 }).notNull(),
	},
	(t) => [
		p.unique().on(t.campaignId, t.roleType),
		p.check(
			"reporting_campaign_contribution_amounts_role_type_enum_check",
			inArray(t.roleType, reportingCampaignContributionRoleEnum),
		),
	],
);

export type ReportingCampaignContributionAmount =
	typeof reportingCampaignContributionAmounts.$inferSelect;
export type ReportingCampaignContributionAmountInput =
	typeof reportingCampaignContributionAmounts.$inferInsert;

export const ReportingCampaignContributionAmountSelectSchema = createSelectSchema(
	reportingCampaignContributionAmounts,
);
export const ReportingCampaignContributionAmountInsertSchema = createInsertSchema(
	reportingCampaignContributionAmounts,
);

export const serviceSizeEnum = ["small", "medium", "large", "very_large", "core"] as const;

export const reportingCampaignServiceSizes = p.snakeCase.table(
	"reporting_campaign_service_sizes",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		campaignId: p
			.uuid("campaign_id")
			.notNull()
			.references(() => reportingCampaigns.id),
		serviceSize: p.text("service_size", { enum: serviceSizeEnum }).notNull(),
		visitsThreshold: p.integer("visits_threshold"),
		amount: p.numeric("amount", { mode: "number", precision: 12, scale: 2 }).notNull(),
	},
	(t) => [
		p.unique().on(t.campaignId, t.serviceSize),
		p.check(
			"reporting_campaign_service_sizes_service_size_enum_check",
			inArray(t.serviceSize, serviceSizeEnum),
		),
	],
);

export type ReportingCampaignServiceSize = typeof reportingCampaignServiceSizes.$inferSelect;
export type ReportingCampaignServiceSizeInput = typeof reportingCampaignServiceSizes.$inferInsert;

export const ReportingCampaignServiceSizeSelectSchema = createSelectSchema(
	reportingCampaignServiceSizes,
);
export const ReportingCampaignServiceSizeInsertSchema = createInsertSchema(
	reportingCampaignServiceSizes,
);

export const reportingCampaignCountryThresholds = p.snakeCase.table(
	"reporting_campaign_country_thresholds",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		campaignId: p
			.uuid("campaign_id")
			.notNull()
			.references(() => reportingCampaigns.id),
		// Document-level: references the country's `entities.id`, not a version id.
		countryDocumentId: p
			.uuid("country_document_id")
			.notNull()
			.references(() => entities.id),
		amount: p.numeric("amount", { mode: "number", precision: 12, scale: 2 }).notNull(),
	},
	(t) => [p.unique().on(t.campaignId, t.countryDocumentId)],
);

export type ReportingCampaignCountryThreshold =
	typeof reportingCampaignCountryThresholds.$inferSelect;
export type ReportingCampaignCountryThresholdInput =
	typeof reportingCampaignCountryThresholds.$inferInsert;

export const ReportingCampaignCountryThresholdSelectSchema = createSelectSchema(
	reportingCampaignCountryThresholds,
);
export const ReportingCampaignCountryThresholdInsertSchema = createInsertSchema(
	reportingCampaignCountryThresholds,
);
export const WorkingGroupReportAnswerUpdateSchema = createUpdateSchema(workingGroupReportAnswers);
