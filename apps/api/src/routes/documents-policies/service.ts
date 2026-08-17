/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { flattenEntityVersion } from "@/lib/entity-version";
import { resolveLocaleContext } from "@/lib/locales";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, asc, count, eq, sql } from "@/services/db/sql";

/**
 * Resolve, per document/policy, the published version to prefer: the requested/default locale's
 * published version, falling back to the default locale's when the document has no version in the
 * preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still works
 * correctly here — both joins target the same locale and `COALESCE` just picks the (identical)
 * match.
 */
async function resolvePublishedDocumentsPoliciesLookup(
	db: Database | Transaction,
	requestedLocaleId?: string,
) {
	const [{ localeId, defaultLocaleId }, type, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityTypes.findFirst({
			where: { type: "documents_policies" },
			columns: { id: true },
		}),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(type, "No documents_policies entity type in database.");
	assert(status, "No published entity status in database.");

	const preferredVersion = alias(schema.entityVersions, "documents_policies_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "documents_policies_default_version");

	return {
		localeId,
		defaultLocaleId,
		typeId: type.id,
		statusId: status.id,
		preferredVersion,
		defaultVersion,
	};
}

function selectDocumentOrPolicyRow() {
	return {
		id: schema.documentsPolicies.id,
		title: schema.documentsPolicies.title,
		summary: schema.documentsPolicies.summary,
		url: schema.documentsPolicies.url,
		position: schema.documentsPolicies.position,
		updatedAt: schema.entityVersions.updatedAt,
		slug: schema.slugs.value,
		groupId: schema.documentPolicyGroups.id,
		groupLabel: schema.documentPolicyGroups.label,
		groupPosition: schema.documentPolicyGroups.position,
	};
}

interface GetDocumentsPoliciesParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getDocumentsPolicies(
	db: Database | Transaction,
	params: GetDocumentsPoliciesParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedDocumentsPoliciesLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select(selectDocumentOrPolicyRow())
			.from(schema.entities)
			.leftJoin(
				preferredVersion,
				and(
					eq(preferredVersion.entityId, schema.entities.id),
					eq(preferredVersion.localeId, localeId),
					eq(preferredVersion.statusId, statusId),
				),
			)
			.leftJoin(
				defaultVersion,
				and(
					eq(defaultVersion.entityId, schema.entities.id),
					eq(defaultVersion.localeId, defaultLocaleId),
					eq(defaultVersion.statusId, statusId),
				),
			)
			.innerJoin(
				schema.entityVersions,
				sql`${schema.entityVersions.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
			)
			.innerJoin(
				schema.documentsPolicies,
				eq(schema.documentsPolicies.id, schema.entityVersions.id),
			)
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.leftJoin(
				schema.documentPolicyGroups,
				eq(schema.documentPolicyGroups.id, schema.documentsPolicies.groupId),
			)
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(
				asc(sql`CASE WHEN ${schema.documentPolicyGroups.id} IS NULL THEN 1 ELSE 0 END`),
				asc(schema.documentPolicyGroups.position),
				asc(schema.documentsPolicies.position),
				asc(schema.documentsPolicies.id),
			)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.documentsPolicies)
			.innerJoin(schema.entityVersions, eq(schema.documentsPolicies.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		return {
			id: item.id,
			title: item.title,
			summary: item.summary,
			url: item.url,
			entity: { slug: item.slug },
			publishedAt: item.updatedAt.toISOString(),
			group:
				item.groupId != null
					? { id: item.groupId, label: item.groupLabel, position: item.groupPosition }
					: null,
		};
	});

	return { data, limit, offset, total };
}

interface GetDocumentsPoliciesTreeParams {
	localeId?: string;
}

export async function getDocumentsPoliciesTree(
	db: Database | Transaction,
	params: GetDocumentsPoliciesTreeParams = {},
) {
	const { localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedDocumentsPoliciesLookup(db, requestedLocaleId);

	const items = await db
		.select(selectDocumentOrPolicyRow())
		.from(schema.entities)
		.leftJoin(
			preferredVersion,
			and(
				eq(preferredVersion.entityId, schema.entities.id),
				eq(preferredVersion.localeId, localeId),
				eq(preferredVersion.statusId, statusId),
			),
		)
		.leftJoin(
			defaultVersion,
			and(
				eq(defaultVersion.entityId, schema.entities.id),
				eq(defaultVersion.localeId, defaultLocaleId),
				eq(defaultVersion.statusId, statusId),
			),
		)
		.innerJoin(
			schema.entityVersions,
			sql`${schema.entityVersions.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
		)
		.innerJoin(schema.documentsPolicies, eq(schema.documentsPolicies.id, schema.entityVersions.id))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.leftJoin(
			schema.documentPolicyGroups,
			eq(schema.documentPolicyGroups.id, schema.documentsPolicies.groupId),
		)
		.where(eq(schema.entities.typeId, typeId));

	const comparePosition = (
		a: { id: string; position: number },
		b: { id: string; position: number },
	) => a.position - b.position || a.id.localeCompare(b.id);

	const groups = new Map<string, { id: string; label: string; position: number }>();
	const groupedItems = new Map<string, typeof items>();
	const ungroupedItems: typeof items = [];

	for (const item of items) {
		if (item.groupId != null) {
			groups.set(item.groupId, {
				id: item.groupId,
				label: item.groupLabel!,
				position: item.groupPosition!,
			});
			const list = groupedItems.get(item.groupId) ?? [];
			list.push(item);
			groupedItems.set(item.groupId, list);
		} else {
			ungroupedItems.push(item);
		}
	}

	const toResponseItem = (item: (typeof items)[number]) => {
		return {
			id: item.id,
			title: item.title,
			summary: item.summary,
			url: item.url,
			entity: { slug: item.slug },
			publishedAt: item.updatedAt.toISOString(),
			type: "item" as const,
		};
	};

	const data = [
		...[...groups.values()].toSorted(comparePosition).map((group) => {
			return {
				id: group.id,
				label: group.label,
				type: "group" as const,
				items: (groupedItems.get(group.id) ?? []).toSorted(comparePosition).map(toResponseItem),
			};
		}),
		...ungroupedItems.toSorted(comparePosition).map(toResponseItem),
	];

	return { data };
}

//

interface GetDocumentOrPolicyByIdParams {
	id: schema.DocumentOrPolicy["id"];
}

export async function getDocumentOrPolicyById(
	db: Database | Transaction,
	params: GetDocumentOrPolicyByIdParams,
) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.documentsPolicies.findFirst({
			where: {
				id,
				entityVersion: {
					status: {
						type: "published",
					},
				},
			},
			columns: {
				id: true,
				title: true,
				summary: true,
				url: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						slug: {
							columns: { value: true },
						},
					},
				},
				group: {
					columns: {
						id: true,
						label: true,
						position: true,
					},
				},
			},
		}),
		getContentBlocks(db, id),
	]);

	if (item == null) {
		return null;
	}

	return { ...flattenEntityVersion(item), ...fields };
}

//

interface GetDocumentOrPolicySlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getDocumentOrPolicySlugs(
	db: Database | Transaction,
	params: GetDocumentOrPolicySlugsParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const { localeId, defaultLocaleId, typeId, statusId, preferredVersion, defaultVersion } =
		await resolvePublishedDocumentsPoliciesLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.documentsPolicies.id,
				slug: schema.slugs.value,
			})
			.from(schema.entities)
			.leftJoin(
				preferredVersion,
				and(
					eq(preferredVersion.entityId, schema.entities.id),
					eq(preferredVersion.localeId, localeId),
					eq(preferredVersion.statusId, statusId),
				),
			)
			.leftJoin(
				defaultVersion,
				and(
					eq(defaultVersion.entityId, schema.entities.id),
					eq(defaultVersion.localeId, defaultLocaleId),
					eq(defaultVersion.statusId, statusId),
				),
			)
			.innerJoin(
				schema.entityVersions,
				sql`${schema.entityVersions.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
			)
			.innerJoin(
				schema.documentsPolicies,
				eq(schema.documentsPolicies.id, schema.entityVersions.id),
			)
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.where(eq(schema.entities.typeId, typeId))
			.orderBy(asc(schema.documentsPolicies.position), asc(schema.documentsPolicies.id))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.documentsPolicies)
			.innerJoin(schema.entityVersions, eq(schema.documentsPolicies.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map(({ id, slug }) => {
		return { id, entity: { slug } };
	});

	return { data, limit, offset, total };
}

//

interface GetDocumentOrPolicyDocumentParams {
	id: schema.DocumentOrPolicy["id"];
}

export async function getDocumentOrPolicyDocument(
	db: Database | Transaction,
	params: GetDocumentOrPolicyDocumentParams,
) {
	const { id } = params;

	const item = await db.query.documentsPolicies.findFirst({
		where: {
			id,
			entityVersion: {
				status: {
					type: "published",
				},
			},
		},
		columns: {
			id: true,
		},
		with: {
			document: {
				columns: {
					filename: true,
					key: true,
					label: true,
					mimeType: true,
				},
			},
		},
	});

	return item ?? null;
}

//

interface GetDocumentOrPolicyBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getDocumentOrPolicyBySlug(
	db: Database | Transaction,
	params: GetDocumentOrPolicyBySlugParams,
) {
	const { slug, localeId } = params;

	const item = await db.query.documentsPolicies.findFirst({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
				slug: {
					value: slug,
					...(localeId != null ? { localeId } : {}),
				},
			},
		},
		columns: {
			id: true,
			title: true,
			summary: true,
			url: true,
		},
		with: {
			entityVersion: {
				columns: { updatedAt: true },
				with: {
					slug: {
						columns: { value: true },
					},
				},
			},
			group: {
				columns: {
					id: true,
					label: true,
					position: true,
				},
			},
		},
	});

	if (item == null) {
		return null;
	}

	const fields = await getContentBlocks(db, item.id);

	return { ...flattenEntityVersion(item), ...fields };
}
