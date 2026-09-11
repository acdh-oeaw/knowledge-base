import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { forbidden } from "next/navigation";

import { contributionOptionsPageSize } from "@/lib/constants/contributions";
import {
	defaultLocaleEntityVersionWhere,
	latestEditableEntityVersionWhere,
	localeMatch,
	publishedEntityVersionWhere,
	statusMatch,
} from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { alias, and, count, desc, eq, inArray, sql } from "@/lib/db/sql";

export type ContributionsSort =
	| "personName"
	| "roleType"
	| "organisationalUnitType"
	| "organisationalUnitName"
	| "durationStart"
	| "durationEnd";

interface GetContributionsParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: ContributionsSort;
	dir?: "asc" | "desc";
}

export interface ContributionsResult {
	data: Array<{
		id: string;
		personDocumentId: string;
		personName: string;
		personSlug: string;
		roleTypeId: string;
		roleType: string;
		organisationalUnitDocumentId: string;
		organisationalUnitName: string;
		organisationalUnitSlug: string;
		organisationalUnitType: string;
		durationStart: Date;
		durationEnd: Date | undefined;
		description: string | null;
	}>;
	limit: number;
	offset: number;
	total: number;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

export async function getContributions(
	params: Readonly<GetContributionsParams>,
): Promise<ContributionsResult> {
	const { limit, offset, q, sort = "personName", dir = "asc" } = params;
	const personEntities = alias(schema.entities, "person_entities");
	const personDocumentLifecycle = alias(schema.documentLifecycle, "person_document_lifecycle");
	const personSlugs = alias(schema.slugs, "person_slugs");
	const organisationalUnitEntities = alias(schema.entities, "organisational_unit_entities");
	const organisationalUnitDocumentLifecycle = alias(
		schema.documentLifecycle,
		"organisational_unit_document_lifecycle",
	);
	const organisationalUnitSlugs = alias(schema.slugs, "organisational_unit_slugs");
	const query = q?.trim();
	// personDocumentId / organisationalUnitDocumentId are document ids; resolve each to its latest
	// editable version (draft when present, else published) for display.
	const personPickedVersion = sql`COALESCE(${personDocumentLifecycle.draftId}, ${personDocumentLifecycle.publishedId})`;
	const organisationalUnitPickedVersion = sql`COALESCE(${organisationalUnitDocumentLifecycle.draftId}, ${organisationalUnitDocumentLifecycle.publishedId})`;
	const searchWhere = matchesAllTerms(
		query,
		schema.persons.name,
		schema.persons.sortName,
		schema.organisationalUnits.name,
		schema.organisationalUnits.acronym,
		schema.organisationalUnitTypes.type,
		schema.personRoleTypes.type,
	);
	const where = searchWhere;
	const orderBy =
		sort === "roleType"
			? dir === "asc"
				? schema.personRoleTypes.type
				: desc(schema.personRoleTypes.type)
			: sort === "organisationalUnitType"
				? dir === "asc"
					? schema.organisationalUnitTypes.type
					: desc(schema.organisationalUnitTypes.type)
				: sort === "organisationalUnitName"
					? dir === "asc"
						? schema.organisationalUnits.name
						: desc(schema.organisationalUnits.name)
					: sort === "durationStart"
						? dir === "asc"
							? sql`LOWER(${schema.personsToOrganisationalUnits.duration}) ASC`
							: sql`LOWER(${schema.personsToOrganisationalUnits.duration}) DESC`
						: sort === "durationEnd"
							? dir === "asc"
								? sql`UPPER(${schema.personsToOrganisationalUnits.duration}) ASC NULLS LAST`
								: sql`UPPER(${schema.personsToOrganisationalUnits.duration}) DESC NULLS LAST`
							: dir === "asc"
								? schema.persons.sortName
								: desc(schema.persons.sortName);

	const [rows, aggregate] = await Promise.all([
		db
			.select({
				id: schema.personsToOrganisationalUnits.id,
				personDocumentId: schema.personsToOrganisationalUnits.personDocumentId,
				personName: schema.persons.name,
				personSlug: personSlugs.value,
				roleTypeId: schema.personsToOrganisationalUnits.roleTypeId,
				roleType: schema.personRoleTypes.type,
				organisationalUnitDocumentId:
					schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				organisationalUnitName: schema.organisationalUnits.name,
				organisationalUnitSlug: organisationalUnitSlugs.value,
				organisationalUnitType: schema.organisationalUnitTypes.type,
				duration: schema.personsToOrganisationalUnits.duration,
				description: schema.personsToOrganisationalUnits.description,
			})
			.from(schema.personsToOrganisationalUnits)
			.innerJoin(
				personEntities,
				eq(personEntities.id, schema.personsToOrganisationalUnits.personDocumentId),
			)
			.innerJoin(personDocumentLifecycle, eq(personDocumentLifecycle.documentId, personEntities.id))
			.innerJoin(schema.persons, sql`${schema.persons.id} = ${personPickedVersion}`)
			.innerJoin(personSlugs, eq(personSlugs.entityVersionId, schema.persons.id))
			.innerJoin(
				schema.personRoleTypes,
				eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
			)
			.innerJoin(
				organisationalUnitEntities,
				eq(
					organisationalUnitEntities.id,
					schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				),
			)
			.innerJoin(
				organisationalUnitDocumentLifecycle,
				eq(organisationalUnitDocumentLifecycle.documentId, organisationalUnitEntities.id),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = ${organisationalUnitPickedVersion}`,
			)
			.innerJoin(
				organisationalUnitSlugs,
				eq(organisationalUnitSlugs.entityVersionId, schema.organisationalUnits.id),
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.where(where)
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.personsToOrganisationalUnits)
			.innerJoin(
				personEntities,
				eq(personEntities.id, schema.personsToOrganisationalUnits.personDocumentId),
			)
			.innerJoin(personDocumentLifecycle, eq(personDocumentLifecycle.documentId, personEntities.id))
			.innerJoin(schema.persons, sql`${schema.persons.id} = ${personPickedVersion}`)
			.innerJoin(
				schema.personRoleTypes,
				eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
			)
			.innerJoin(
				organisationalUnitEntities,
				eq(
					organisationalUnitEntities.id,
					schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				),
			)
			.innerJoin(
				organisationalUnitDocumentLifecycle,
				eq(organisationalUnitDocumentLifecycle.documentId, organisationalUnitEntities.id),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = ${organisationalUnitPickedVersion}`,
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.where(where),
	]);

	return {
		data: rows.map((row) => {
			return {
				id: row.id,
				personDocumentId: row.personDocumentId,
				personName: row.personName,
				personSlug: row.personSlug,
				roleTypeId: row.roleTypeId,
				roleType: row.roleType,
				organisationalUnitDocumentId: row.organisationalUnitDocumentId,
				organisationalUnitName: row.organisationalUnitName,
				organisationalUnitSlug: row.organisationalUnitSlug,
				organisationalUnitType: row.organisationalUnitType,
				durationStart: row.duration.start,
				durationEnd: row.duration.end,
				description: row.description,
			};
		}),
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getContributionsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetContributionsParams>,
): Promise<ContributionsResult> {
	assertAdminUser(currentUser);

	return getContributions(params);
}

/**
 * `personDocumentId` is the person's `entities.id`. Resolves each related organisational unit to
 * its latest editable version in `localeId` (or the default locale when omitted), falling back to
 * the default locale per-unit when a unit has no version in `localeId` — the unit's name/slug are
 * translatable, unlike the person's own name.
 *
 * "Contribution" here is a data-migration leftover: these rows are simply relations between a
 * person and an organisational unit, and not every role is a contribution to DARIAH. The same table
 * is read from the org side as "person relations" (`lib/data/person-relations.ts`) and exposed by
 * the api as `positions` (`apps/api/src/lib/persons.ts`) — one concept, three names.
 *
 * Unrelated to a person's article credits, despite `articleContributorRolesEnum` also using the
 * word: those live in `lib/data/article-contributors.ts`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getPersonContributions(personDocumentId: string, localeId?: string) {
	const unitSelectedDraft = alias(schema.entityVersions, "contribution_unit_selected_draft");
	const unitSelectedPublished = alias(
		schema.entityVersions,
		"contribution_unit_selected_published",
	);
	const unitDefaultDraft = alias(schema.entityVersions, "contribution_unit_default_draft");
	const unitDefaultPublished = alias(schema.entityVersions, "contribution_unit_default_published");

	return db
		.select({
			id: schema.personsToOrganisationalUnits.id,
			duration: schema.personsToOrganisationalUnits.duration,
			roleTypeId: schema.personsToOrganisationalUnits.roleTypeId,
			roleType: schema.personRoleTypes.type,
			organisationalUnitDocumentId:
				schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			organisationalUnitName: schema.organisationalUnits.name,
			organisationalUnitSlug: schema.slugs.value,
			organisationalUnitType: schema.organisationalUnitTypes.type,
			organisationalUnitIsLocaleFallback: sql<boolean>`(${unitSelectedDraft.id} IS NULL AND ${unitSelectedPublished.id} IS NULL)`,
			description: schema.personsToOrganisationalUnits.description,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.leftJoin(
			unitSelectedDraft,
			and(
				eq(
					unitSelectedDraft.entityId,
					schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				),
				localeMatch(unitSelectedDraft.localeId, localeId),
				statusMatch(unitSelectedDraft.statusId, "draft"),
			),
		)
		.leftJoin(
			unitSelectedPublished,
			and(
				eq(
					unitSelectedPublished.entityId,
					schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				),
				localeMatch(unitSelectedPublished.localeId, localeId),
				statusMatch(unitSelectedPublished.statusId, "published"),
			),
		)
		.leftJoin(
			unitDefaultDraft,
			and(
				eq(
					unitDefaultDraft.entityId,
					schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				),
				localeMatch(unitDefaultDraft.localeId, undefined),
				statusMatch(unitDefaultDraft.statusId, "draft"),
			),
		)
		.leftJoin(
			unitDefaultPublished,
			and(
				eq(
					unitDefaultPublished.entityId,
					schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				),
				localeMatch(unitDefaultPublished.localeId, undefined),
				statusMatch(unitDefaultPublished.statusId, "published"),
			),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${unitSelectedDraft.id}, ${unitSelectedPublished.id}, ${unitDefaultDraft.id}, ${unitDefaultPublished.id})`,
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(eq(schema.personsToOrganisationalUnits.personDocumentId, personDocumentId));
}

export type PersonContribution = Awaited<ReturnType<typeof getPersonContributions>>[number];

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getContributionRoleOptions() {
	const rows = await db
		.select({
			roleTypeId: schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.roleTypeId,
			roleType: schema.personRoleTypes.type,
			unitType: schema.organisationalUnitTypes.type,
		})
		.from(schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations)
		.innerJoin(
			schema.personRoleTypes,
			eq(
				schema.personRoleTypes.id,
				schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.roleTypeId,
			),
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(
				schema.organisationalUnitTypes.id,
				schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.unitTypeId,
			),
		)
		.orderBy(schema.personRoleTypes.type, schema.organisationalUnitTypes.type);

	const uniqueRoleOptions = new Map<
		string,
		{ roleType: string; roleTypeId: string; allowedUnitTypes: Array<string> }
	>();

	for (const row of rows) {
		if (!uniqueRoleOptions.has(row.roleTypeId)) {
			uniqueRoleOptions.set(row.roleTypeId, {
				roleType: row.roleType,
				roleTypeId: row.roleTypeId,
				allowedUnitTypes: [],
			});
		}

		uniqueRoleOptions.get(row.roleTypeId)?.allowedUnitTypes.push(row.unitType);
	}

	return Array.from(uniqueRoleOptions.values());
}

export type ContributionRoleOption = Awaited<ReturnType<typeof getContributionRoleOptions>>[number];

interface GetContributionOptionsParams {
	limit?: number;
	offset?: number;
	q?: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getContributionPersonOptions(
	params: GetContributionOptionsParams & { includeDrafts?: boolean } = {},
) {
	const { limit = contributionOptionsPageSize, offset = 0, q, includeDrafts = false } = params;
	const query = q?.trim();
	const searchWhere = matchesAllTerms(query, schema.persons.name, schema.persons.sortName);
	// Pickers normally offer published persons only. Delegated dashboards opt in to draft-or-published so
	// a coordinator can relate a person they just created (still a draft) — one row per document.
	const lifecycleWhere = includeDrafts
		? latestEditableEntityVersionWhere()
		: publishedEntityVersionWhere();
	const where = and(lifecycleWhere, defaultLocaleEntityVersionWhere(), searchWhere);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.entityVersions.entityId,
				name: schema.persons.name,
				sortName: schema.persons.sortName,
			})
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where)
			.orderBy(schema.persons.sortName)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where),
	]);

	return { items, total: aggregate.at(0)?.total ?? 0 };
}

export type ContributionPersonOption = Awaited<
	ReturnType<typeof getContributionPersonOptions>
>["items"][number];

interface GetContributionOrganisationalUnitOptionsParams extends GetContributionOptionsParams {
	roleTypeId?: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getContributionOrganisationalUnitOptions(
	params: GetContributionOrganisationalUnitOptionsParams = {},
) {
	const { limit = contributionOptionsPageSize, offset = 0, q, roleTypeId } = params;

	if (roleTypeId == null || roleTypeId === "") {
		return { items: [], total: 0 };
	}

	const query = q?.trim();
	const where = and(
		publishedEntityVersionWhere(),
		defaultLocaleEntityVersionWhere(),
		eq(schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.roleTypeId, roleTypeId),
		matchesAllTerms(query, schema.organisationalUnits.name, schema.organisationalUnits.acronym),
	);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.entityVersions.entityId,
				name: schema.organisationalUnits.name,
			})
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(
				schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations,
				eq(
					schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.unitTypeId,
					schema.organisationalUnits.typeId,
				),
			)
			.where(where)
			.orderBy(schema.organisationalUnits.name)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(
				schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations,
				eq(
					schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.unitTypeId,
					schema.organisationalUnits.typeId,
				),
			)
			.where(where),
	]);

	return { items, total: aggregate.at(0)?.total ?? 0 };
}

export type ContributionOrganisationalUnitOption = Awaited<
	ReturnType<typeof getContributionOrganisationalUnitOptions>
>["items"][number];

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getContributionOptions() {
	const allowedCombos = await db
		.select({
			roleTypeId: schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.roleTypeId,
			roleType: schema.personRoleTypes.type,
			unitTypeId: schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.unitTypeId,
		})
		.from(schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations)
		.innerJoin(
			schema.personRoleTypes,
			eq(
				schema.personRoleTypes.id,
				schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.roleTypeId,
			),
		);

	if (allowedCombos.length === 0) {
		return [];
	}

	const unitTypeIds = [...new Set(allowedCombos.map((c) => c.unitTypeId))];

	const orgUnits = await db
		.select({
			id: schema.entityVersions.entityId,
			name: schema.organisationalUnits.name,
			typeId: schema.organisationalUnits.typeId,
		})
		.from(schema.organisationalUnits)
		.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.where(
			and(
				publishedEntityVersionWhere(),
				defaultLocaleEntityVersionWhere(),
				inArray(schema.organisationalUnits.typeId, unitTypeIds),
			),
		);

	const byRole = new Map<
		string,
		{ roleTypeId: string; roleType: string; availableUnits: Array<{ id: string; name: string }> }
	>();

	for (const combo of allowedCombos) {
		if (!byRole.has(combo.roleTypeId)) {
			byRole.set(combo.roleTypeId, {
				roleTypeId: combo.roleTypeId,
				roleType: combo.roleType,
				availableUnits: [],
			});
		}

		const entry = byRole.get(combo.roleTypeId)!;

		for (const unit of orgUnits) {
			if (unit.typeId === combo.unitTypeId && !entry.availableUnits.some((u) => u.id === unit.id)) {
				entry.availableUnits.push({ id: unit.id, name: unit.name });
			}
		}
	}

	return Array.from(byRole.values()).map((entry) => {
		return {
			...entry,
			availableUnits: entry.availableUnits.toSorted((a, b) => a.name.localeCompare(b.name)),
		};
	});
}

export type ContributionOption = Awaited<ReturnType<typeof getContributionOptions>>[number];

/**
 * Country options for the user "country actor" picker. Returns organisational-unit _document_ ids
 * (resolved from the published version) because `users.organisationalUnitDocumentId` is a document
 * id.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getCountryOptions(params: GetContributionOptionsParams = {}) {
	const { limit = contributionOptionsPageSize, offset = 0, q } = params;
	const query = q?.trim();

	const where = and(
		publishedEntityVersionWhere(),
		defaultLocaleEntityVersionWhere(),
		eq(schema.organisationalUnitTypes.type, "country"),
		matchesAllTerms(query, schema.organisationalUnits.name, schema.organisationalUnits.acronym),
	);

	const [items, aggregate] = await Promise.all([
		db
			.select({ id: schema.entityVersions.entityId, name: schema.organisationalUnits.name })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.where(where)
			.orderBy(schema.organisationalUnits.name)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.where(where),
	]);

	return { items, total: aggregate.at(0)?.total ?? 0 };
}

export type CountryOption = Awaited<ReturnType<typeof getCountryOptions>>["items"][number];
