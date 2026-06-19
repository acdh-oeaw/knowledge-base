import { type Transaction, createDatabaseService } from "@acdh-knowledge-base/database";
import * as schema from "@acdh-knowledge-base/database/schema";
import { and, eq } from "@acdh-knowledge-base/database/sql";
import { log } from "@acdh-oeaw/lib";

import { env } from "../config/env.config";

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		ssl: env.DATABASE_SSL_CONNECTION === "enabled",
		user: env.DATABASE_USER,
	},
	logger: false,
}).unwrap();

// Fixed UUIDs for navigation rows so re-runs stay idempotent.
const NAV_PRIMARY_MENU_ID = "019680a1-0000-7000-8000-000000000001";
const NAV_SECONDARY_MENU_ID = "019680a1-0000-7000-8000-000000000002";

type EntityType = (typeof schema.entityTypesEnum)[number];
type OrgUnitType = (typeof schema.organisationalUnitTypesEnum)[number];
type OrgUnitStatus = (typeof schema.organisationalUnitStatusEnum)[number];
type PersonRoleType = (typeof schema.personRoleTypesEnum)[number];

const entityTypeFieldMappings: Array<{ entityType: EntityType; fieldName: string }> = [
	{ entityType: "documentation_pages", fieldName: "content" },
	{ entityType: "documents_policies", fieldName: "description" },
	{ entityType: "events", fieldName: "content" },
	{ entityType: "external_links", fieldName: "description" },
	{ entityType: "funding_calls", fieldName: "content" },
	{ entityType: "impact_case_studies", fieldName: "content" },
	{ entityType: "internal_pages", fieldName: "content" },
	{ entityType: "news", fieldName: "content" },
	{ entityType: "opportunities", fieldName: "content" },
	{ entityType: "organisational_units", fieldName: "description" },
	{ entityType: "pages", fieldName: "content" },
	{ entityType: "persons", fieldName: "biography" },
	{ entityType: "projects", fieldName: "description" },
	{ entityType: "spotlight_articles", fieldName: "content" },
];

const orgUnitAllowedRelations: Array<{
	unitType: OrgUnitType;
	relatedUnitType: OrgUnitType;
	relationType: OrgUnitStatus;
}> = [
	{ unitType: "governance_body", relatedUnitType: "eric", relationType: "is_part_of" },
	{ unitType: "country", relatedUnitType: "eric", relationType: "is_member_of" },
	{ unitType: "country", relatedUnitType: "eric", relationType: "is_observer_of" },
	{
		unitType: "national_consortium",
		relatedUnitType: "country",
		relationType: "is_national_consortium_of",
	},
	{ unitType: "institution", relatedUnitType: "country", relationType: "is_located_in" },
	{ unitType: "institution", relatedUnitType: "regional_hub", relationType: "is_member_of" },
	{ unitType: "institution", relatedUnitType: "national_consortium", relationType: "is_member_of" },
	{ unitType: "institution", relatedUnitType: "eric", relationType: "is_partner_institution_of" },
	{ unitType: "institution", relatedUnitType: "eric", relationType: "is_cooperating_partner_of" },
	{
		unitType: "institution",
		relatedUnitType: "eric",
		relationType: "is_national_coordinating_institution_in",
	},
	{
		unitType: "institution",
		relatedUnitType: "eric",
		relationType: "is_national_representative_institution_in",
	},
	{ unitType: "working_group", relatedUnitType: "eric", relationType: "is_part_of" },
];

const personRoleToUnitTypeMappings: Array<{
	roleType: PersonRoleType;
	unitType: OrgUnitType;
}> = [
	{ roleType: "is_affiliated_with", unitType: "institution" },
	{ roleType: "is_chair_of", unitType: "governance_body" },
	{ roleType: "is_chair_of", unitType: "working_group" },
	{ roleType: "is_vice_chair_of", unitType: "governance_body" },
	{ roleType: "is_member_of", unitType: "governance_body" },
	{ roleType: "is_member_of", unitType: "working_group" },
	{ roleType: "is_member_of", unitType: "institution" },
	{ roleType: "is_contact_for", unitType: "governance_body" },
	{ roleType: "is_contact_for", unitType: "working_group" },
	{ roleType: "is_contact_for", unitType: "institution" },
	{ roleType: "is_contact_for", unitType: "national_consortium" },
	{ roleType: "is_contact_for", unitType: "eric" },
	{ roleType: "is_contact_for", unitType: "country" },
	{ roleType: "is_contact_for", unitType: "regional_hub" },
	{ roleType: "national_coordinator", unitType: "country" },
	{ roleType: "national_coordinator_deputy", unitType: "country" },
	{ roleType: "national_coordination_staff", unitType: "country" },
	{ roleType: "national_representative", unitType: "country" },
	{ roleType: "national_representative_deputy", unitType: "country" },
];

const governanceBodies = [
	{ slug: "board-of-directors", name: "Board of directors", acronym: "bod" },
	{ slug: "dariah-coordination-office", name: "DARIAH coordination office", acronym: "dco" },
	{ slug: "general-assembly", name: "General assembly", acronym: "ga" },
	{ slug: "joint-research-committee", name: "Joint research committee", acronym: "jrc" },
	{
		slug: "national-coordinators-committee",
		name: "National coordinators committee",
		acronym: "ncc",
	},
	{ slug: "scientific-advisory-board", name: "Scientific advisory board", acronym: "sab" },
	{ slug: "senior-management-team", name: "Senior management team", acronym: "smt" },
] as const;

const internalPageSlugs = ["privacy-policy", "terms-of-use"] as const;
const internalPageTitles: Record<(typeof internalPageSlugs)[number], string> = {
	"privacy-policy": "Privacy policy",
	"terms-of-use": "Terms of use",
};

async function insertEntity(tx: Transaction, typeId: string, slug: string): Promise<string> {
	const inserted = await tx
		.insert(schema.entities)
		.values({ typeId, slug })
		.onConflictDoNothing()
		.returning({ id: schema.entities.id });

	if (inserted[0]) {
		return inserted[0].id;
	}

	const existing = await tx
		.select({ id: schema.entities.id })
		.from(schema.entities)
		.where(and(eq(schema.entities.typeId, typeId), eq(schema.entities.slug, slug)));
	return existing[0]!.id;
}

async function insertEntityVersion(
	tx: Transaction,
	entityId: string,
	statusId: string,
): Promise<string> {
	const inserted = await tx
		.insert(schema.entityVersions)
		.values({ entityId, statusId })
		.onConflictDoNothing()
		.returning({ id: schema.entityVersions.id });

	if (inserted[0]) {
		return inserted[0].id;
	}

	const existing = await tx
		.select({ id: schema.entityVersions.id })
		.from(schema.entityVersions)
		.where(
			and(
				eq(schema.entityVersions.entityId, entityId),
				eq(schema.entityVersions.statusId, statusId),
			),
		);
	return existing[0]!.id;
}

async function seedCms(tx: Transaction) {
	// ---- Enum vocabulary tables ----

	await tx
		.insert(schema.contentBlockTypes)
		.values(
			schema.contentBlockTypesEnum.map((type) => {
				return { type };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.dataContentBlockTypes)
		.values(
			schema.dataContentBlockTypesEnum.map((type) => {
				return { type };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.entityStatus)
		.values(
			schema.entityStatusEnum.map((type) => {
				return { type };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.entityTypes)
		.values(
			schema.entityTypesEnum.map((type) => {
				return { type };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.licenses)
		.values([
			{
				code: "CC0-1.0",
				name: "Creative Commons Zero v1.0 Universal",
				url: "https://creativecommons.org/publicdomain/zero/1.0/",
			},
			{
				code: "CC-PDM-1.0",
				name: "Creative Commons Public Domain Mark 1.0 Universal",
				url: "https://creativecommons.org/publicdomain/mark/1.0/",
			},
			{
				code: "CC-BY-4.0",
				name: "Creative Commons Attribution 4.0 International",
				url: "https://creativecommons.org/licenses/by/4.0/",
			},
			{
				code: "CC-BY-NC-4.0",
				name: "Creative Commons Attribution Non Commercial 4.0 International",
				url: "https://creativecommons.org/licenses/by-nc/4.0/",
			},
			{
				code: "CC-BY-NC-ND-4.0",
				name: "Creative Commons Attribution Non Commercial No Derivatives 4.0 International",
				url: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
			},
			{
				code: "CC-BY-NC-SA-4.0",
				name: "Creative Commons Attribution Non Commercial Share Alike 4.0 International",
				url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
			},
			{
				code: "CC-BY-ND-4.0",
				name: "Creative Commons Attribution No Derivatives 4.0 International",
				url: "https://creativecommons.org/licenses/by-nd/4.0/",
			},
			{
				code: "CC-BY-SA-4.0",
				name: "Creative Commons Attribution Share Alike 4.0 International",
				url: "https://creativecommons.org/licenses/by-sa/4.0/",
			},
		])
		.onConflictDoNothing();

	await tx
		.insert(schema.opportunitySources)
		.values(
			schema.opportunitySourcesEnum.map((source) => {
				return { source };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.organisationalUnitServiceRoles)
		.values(
			schema.organisationalUnitServiceRolesEnum.map((role) => {
				return { role };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.organisationalUnitStatus)
		.values(
			schema.organisationalUnitStatusEnum.map((status) => {
				return { status };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.organisationalUnitTypes)
		.values(
			schema.organisationalUnitTypesEnum.map((type) => {
				return { type };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.personRoleTypes)
		.values(
			schema.personRoleTypesEnum.map((type) => {
				return { type };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.projectRoles)
		.values(
			schema.projectRolesEnum.map((role) => {
				return { role };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.projectScopes)
		.values(
			schema.projectScopesEnum.map((scope) => {
				return { scope };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.serviceStatuses)
		.values(
			schema.serviceStatusesEnum.map((status) => {
				return { status };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.serviceTypes)
		.values(
			schema.serviceTypesEnum.map((type) => {
				return { type };
			}),
		)
		.onConflictDoNothing();

	await tx
		.insert(schema.socialMediaTypes)
		.values(
			schema.socialMediaTypesEnum.map((type) => {
				return { type };
			}),
		)
		.onConflictDoNothing();

	// ---- Relationship rule tables (depend on enum tables above) ----

	const entityTypeRows = await tx
		.select({ id: schema.entityTypes.id, type: schema.entityTypes.type })
		.from(schema.entityTypes);
	const entityTypeIdByType = new Map(entityTypeRows.map((r) => [r.type, r.id]));

	await tx
		.insert(schema.entityTypesFieldsNames)
		.values(
			entityTypeFieldMappings.map(({ entityType, fieldName }) => {
				return {
					entityTypeId: entityTypeIdByType.get(entityType)!,
					fieldName,
				};
			}),
		)
		.onConflictDoNothing();

	const unitTypeRows = await tx
		.select({ id: schema.organisationalUnitTypes.id, type: schema.organisationalUnitTypes.type })
		.from(schema.organisationalUnitTypes);
	const unitTypeIdByType = new Map(unitTypeRows.map((r) => [r.type, r.id]));

	const unitStatusRows = await tx
		.select({
			id: schema.organisationalUnitStatus.id,
			status: schema.organisationalUnitStatus.status,
		})
		.from(schema.organisationalUnitStatus);
	const unitStatusIdByStatus = new Map(unitStatusRows.map((r) => [r.status, r.id]));

	await tx
		.insert(schema.organisationalUnitsAllowedRelations)
		.values(
			orgUnitAllowedRelations.map(({ unitType, relatedUnitType, relationType }) => {
				return {
					unitTypeId: unitTypeIdByType.get(unitType)!,
					relatedUnitTypeId: unitTypeIdByType.get(relatedUnitType)!,
					relationTypeId: unitStatusIdByStatus.get(relationType)!,
				};
			}),
		)
		.onConflictDoNothing();

	const roleTypeRows = await tx
		.select({ id: schema.personRoleTypes.id, type: schema.personRoleTypes.type })
		.from(schema.personRoleTypes);
	const roleTypeIdByType = new Map(roleTypeRows.map((r) => [r.type, r.id]));

	await tx
		.insert(schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations)
		.values(
			personRoleToUnitTypeMappings.map(({ roleType, unitType }) => {
				return {
					roleTypeId: roleTypeIdByType.get(roleType)!,
					unitTypeId: unitTypeIdByType.get(unitType)!,
				};
			}),
		)
		.onConflictDoNothing();

	// ---- CMS content (required for a functional instance) ----

	const entityStatusRows = await tx
		.select({ id: schema.entityStatus.id, type: schema.entityStatus.type })
		.from(schema.entityStatus);
	const entityStatusIdByType = new Map(entityStatusRows.map((r) => [r.type, r.id]));

	const orgUnitTypeId = entityTypeIdByType.get("organisational_units")!;
	const internalPageTypeId = entityTypeIdByType.get("internal_pages")!;
	const publishedStatusId = entityStatusIdByType.get("published")!;
	const draftStatusId = entityStatusIdByType.get("draft")!;
	const ericTypeId = unitTypeIdByType.get("eric")!;
	const governanceBodyTypeId = unitTypeIdByType.get("governance_body")!;
	const isPartOfStatusId = unitStatusIdByStatus.get("is_part_of")!;

	// DARIAH-EU

	const dariahEuDocId = await insertEntity(tx, orgUnitTypeId, "dariah-eu");
	const dariahEuVersionId = await insertEntityVersion(tx, dariahEuDocId, publishedStatusId);

	await tx
		.insert(schema.organisationalUnits)
		.values({
			id: dariahEuVersionId,
			name: "DARIAH-EU",
			summary: "",
			typeId: ericTypeId,
			ror: "https://ror.org/05n09v162",
		})
		.onConflictDoNothing();

	// Governance bodies

	for (const body of governanceBodies) {
		const docId = await insertEntity(tx, orgUnitTypeId, body.slug);
		const versionId = await insertEntityVersion(tx, docId, publishedStatusId);

		await tx
			.insert(schema.organisationalUnits)
			.values({
				id: versionId,
				name: body.name,
				acronym: body.acronym,
				summary: "",
				typeId: governanceBodyTypeId,
			})
			.onConflictDoNothing();

		await tx
			.insert(schema.organisationalUnitsRelations)
			.values({
				unitDocumentId: docId,
				relatedUnitDocumentId: dariahEuDocId,
				status: isPartOfStatusId,
				// @see https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32014D0526
				duration: { start: new Date("2014-08-06"), end: undefined },
			})
			.onConflictDoNothing();
	}

	// Site metadata

	await tx
		.insert(schema.siteMetadata)
		.values({
			id: 1,
			title: "DARIAH-EU",
			description: "The pan-European infrastructure for arts and humanities scholars.",
		})
		.onConflictDoNothing();

	// Navigation

	await tx
		.insert(schema.navigationMenus)
		.values([
			{ id: NAV_PRIMARY_MENU_ID, name: "primary" },
			{ id: NAV_SECONDARY_MENU_ID, name: "secondary" },
		])
		.onConflictDoNothing();

	await tx
		.insert(schema.navigationItems)
		.values([
			// Primary — top-level
			{
				id: "019680a1-0001-7000-8000-000000000002",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: null,
				label: "About",
				href: null,
				isExternal: false,
				position: 0,
			},
			{
				id: "019680a1-0001-7000-8000-000000000003",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: null,
				label: "Network",
				href: null,
				isExternal: false,
				position: 1,
			},
			{
				id: "019680a1-0001-7000-8000-000000000004",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: null,
				label: "Resources",
				href: null,
				isExternal: false,
				position: 2,
			},
			{
				id: "019680a1-0001-7000-8000-000000000005",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: null,
				label: "Projects",
				href: "/projects",
				isExternal: false,
				position: 3,
			},
			{
				id: "019680a1-0001-7000-8000-000000000006",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: null,
				label: "News and events",
				href: null,
				isExternal: false,
				position: 4,
			},
			{
				id: "019680a1-0001-7000-8000-000000000007",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: null,
				label: "Get involved",
				href: null,
				isExternal: false,
				position: 5,
			},
			// Primary — About children
			{
				id: "019680a1-0002-7000-8000-000000000001",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000002",
				label: "DARIAH in a nutshell",
				href: "/about/dariah-in-a-nutshell",
				isExternal: false,
				position: 0,
			},
			{
				id: "019680a1-0002-7000-8000-000000000002",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000002",
				label: "Strategy",
				href: "/about/strategy",
				isExternal: false,
				position: 1,
			},
			{
				id: "019680a1-0002-7000-8000-000000000003",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000002",
				label: "Organisation and governance",
				href: "/about/organisation-and-governance",
				isExternal: false,
				position: 2,
			},
			{
				id: "019680a1-0002-7000-8000-000000000004",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000002",
				label: "Impact case studies",
				href: "/about/impact-case-studies",
				isExternal: false,
				position: 3,
			},
			{
				id: "019680a1-0002-7000-8000-000000000005",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000002",
				label: "Documents and policies",
				href: "/about/documents",
				isExternal: false,
				position: 4,
			},
			// Primary — Network children
			{
				id: "019680a1-0003-7000-8000-000000000001",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000003",
				label: "Members and partners",
				href: "/network/members-and-partners",
				isExternal: false,
				position: 0,
			},
			{
				id: "019680a1-0003-7000-8000-000000000002",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000003",
				label: "Regional hubs",
				href: "/network/regional-hubs",
				isExternal: false,
				position: 1,
			},
			{
				id: "019680a1-0003-7000-8000-000000000003",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000003",
				label: "Working groups",
				href: "/network/working-groups",
				isExternal: false,
				position: 2,
			},
			{
				id: "019680a1-0003-7000-8000-000000000004",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000003",
				label: "Partnerships and collaborations",
				href: "/network/partnerships-and-collaborations",
				isExternal: false,
				position: 3,
			},
			// Primary — Resources children
			{
				id: "019680a1-0004-7000-8000-000000000001",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000004",
				label: "DARIAH resource catalogue",
				href: "/resources/dariah-resource-catalogue",
				isExternal: false,
				position: 0,
			},
			{
				id: "019680a1-0004-7000-8000-000000000002",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000004",
				label: "DARIAH-Campus",
				href: "/resources/dariah-campus",
				isExternal: false,
				position: 1,
			},
			{
				id: "019680a1-0004-7000-8000-000000000003",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000004",
				label: "Transformations",
				href: "/resources/transformations",
				isExternal: false,
				position: 2,
			},
			{
				id: "019680a1-0004-7000-8000-000000000004",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000004",
				label: "SSH Open Marketplace",
				href: "/resources/ssh-open-marketplace",
				isExternal: false,
				position: 3,
			},
			// Primary — News and events children
			{
				id: "019680a1-0005-7000-8000-000000000001",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000006",
				label: "News",
				href: "/news",
				isExternal: false,
				position: 0,
			},
			{
				id: "019680a1-0005-7000-8000-000000000002",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000006",
				label: "Events",
				href: "/events",
				isExternal: false,
				position: 1,
			},
			{
				id: "019680a1-0005-7000-8000-000000000003",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000006",
				label: "Spotlights",
				href: "/spotlights",
				isExternal: false,
				position: 2,
			},
			{
				id: "019680a1-0005-7000-8000-000000000004",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000006",
				label: "Annual events",
				href: "https://annualevent.dariah.eu",
				isExternal: true,
				position: 3,
			},
			{
				id: "019680a1-0005-7000-8000-000000000005",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000006",
				label: "Newsletters",
				href: "/newsletters",
				isExternal: false,
				position: 4,
			},
			// Primary — Get involved children
			{
				id: "019680a1-0006-7000-8000-000000000001",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000007",
				label: "Join DARIAH",
				href: "/get-involved/join-dariah",
				isExternal: false,
				position: 0,
			},
			{
				id: "019680a1-0006-7000-8000-000000000002",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000007",
				label: "Funding calls",
				href: "/get-involved/funding-calls",
				isExternal: false,
				position: 1,
			},
			{
				id: "019680a1-0006-7000-8000-000000000004",
				menuId: NAV_PRIMARY_MENU_ID,
				parentId: "019680a1-0001-7000-8000-000000000007",
				label: "Opportunities",
				href: "/get-involved/opportunities",
				isExternal: false,
				position: 2,
			},
			// Secondary — top-level
			{
				id: "019680a2-0001-7000-8000-000000000002",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: null,
				label: "Contact Dariah",
				href: null,
				isExternal: false,
				position: 0,
			},
			{
				id: "019680a2-0001-7000-8000-000000000003",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: null,
				label: "Privacy and Legal",
				href: null,
				isExternal: false,
				position: 1,
			},
			{
				id: "019680a2-0001-7000-8000-000000000004",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: null,
				label: "Quick menu",
				href: null,
				isExternal: false,
				position: 2,
			},
			// Secondary — Contact children
			{
				id: "019680a2-0002-7000-8000-000000000001",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: "019680a2-0001-7000-8000-000000000002",
				label: "Helpdesk",
				href: "/contact",
				isExternal: false,
				position: 0,
			},
			// Secondary — Privacy and Legal children
			{
				id: "019680a2-0003-7000-8000-000000000001",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: "019680a2-0001-7000-8000-000000000003",
				label: "Legal notice",
				href: "/",
				isExternal: false,
				position: 0,
			},
			{
				id: "019680a2-0003-7000-8000-000000000002",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: "019680a2-0001-7000-8000-000000000003",
				label: "Practice",
				href: "/",
				isExternal: false,
				position: 1,
			},
			{
				id: "019680a2-0003-7000-8000-000000000003",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: "019680a2-0001-7000-8000-000000000003",
				label: "Accessibility declaration",
				href: "/",
				isExternal: false,
				position: 2,
			},
			// Secondary — Quick menu children
			{
				id: "019680a2-0004-7000-8000-000000000001",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: "019680a2-0001-7000-8000-000000000004",
				label: "DARIAH in Nutshell",
				href: "/",
				isExternal: false,
				position: 0,
			},
			{
				id: "019680a2-0004-7000-8000-000000000002",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: "019680a2-0001-7000-8000-000000000004",
				label: "Members and Partners",
				href: "/",
				isExternal: false,
				position: 1,
			},
			{
				id: "019680a2-0004-7000-8000-000000000003",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: "019680a2-0001-7000-8000-000000000004",
				label: "Projects",
				href: "/",
				isExternal: false,
				position: 2,
			},
			{
				id: "019680a2-0004-7000-8000-000000000004",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: "019680a2-0001-7000-8000-000000000004",
				label: "Events Calendar",
				href: "/",
				isExternal: false,
				position: 3,
			},
			{
				id: "019680a2-0004-7000-8000-000000000005",
				menuId: NAV_SECONDARY_MENU_ID,
				parentId: "019680a2-0001-7000-8000-000000000004",
				label: "Website User Survey",
				href: "/",
				isExternal: false,
				position: 4,
			},
		])
		.onConflictDoNothing();

	// Internal pages

	const fieldNameRows = await tx
		.select({
			id: schema.entityTypesFieldsNames.id,
			entityTypeId: schema.entityTypesFieldsNames.entityTypeId,
			fieldName: schema.entityTypesFieldsNames.fieldName,
		})
		.from(schema.entityTypesFieldsNames);

	const internalPageFieldNameId = fieldNameRows.find(
		(r) => r.entityTypeId === internalPageTypeId && r.fieldName === "content",
	)!.id;

	for (const slug of internalPageSlugs) {
		const docId = await insertEntity(tx, internalPageTypeId, slug);

		for (const statusId of [publishedStatusId, draftStatusId]) {
			const versionId = await insertEntityVersion(tx, docId, statusId);

			await tx
				.insert(schema.internalPages)
				.values({ id: versionId, title: internalPageTitles[slug] })
				.onConflictDoNothing();

			await tx
				.insert(schema.fields)
				.values({ entityVersionId: versionId, fieldNameId: internalPageFieldNameId })
				.onConflictDoNothing();
		}
	}
}

async function main() {
	await db.transaction(seedCms);
	log.success("Successfully seeded CMS data.");
}

main()
	.catch((error: unknown) => {
		log.error("Failed to seed CMS data.\n", error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises
	.finally(() =>
		// oxlint-disable-next-line typescript/strict-void-return
		db.$client.end().catch((error: unknown) => {
			log.error("Failed to close database connection.\n", error);
			process.exitCode = 1;
		}),
	);
