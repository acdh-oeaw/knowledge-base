/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { flattenEntityVersion } from "@/lib/entity-version";
import type { Database, Transaction } from "@/middlewares/db";
import { count, eq } from "@/services/db/sql";

interface GetDocumentsPoliciesParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getDocumentsPolicies(
	db: Database | Transaction,
	params: GetDocumentsPoliciesParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.documentsPolicies.findMany({
			where: {
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
				position: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true },
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
			orderBy(t, { asc, sql }) {
				return [
					asc(sql`CASE WHEN "group"."r" IS NULL THEN 1 ELSE 0 END`),
					asc(sql`("group"."r" ->> 'position')::integer`),
					asc(t.position),
					asc(t.id),
				];
			},
			limit,
			offset,
		}),
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

	const data = items.map(({ position: _position, ...item }) => flattenEntityVersion(item));

	return { data, limit, offset, total };
}

export async function getDocumentsPoliciesTree(db: Database | Transaction) {
	const [groups, items] = await Promise.all([
		db.query.documentPolicyGroups.findMany({
			columns: {
				id: true,
				label: true,
				position: true,
			},
		}),
		db.query.documentsPolicies.findMany({
			where: {
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
				groupId: true,
				position: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true },
						},
					},
				},
			},
		}),
	]);

	const comparePosition = (
		a: { id: string; position: number },
		b: { id: string; position: number },
	) => a.position - b.position || a.id.localeCompare(b.id);

	const groupedItems = new Map<string, typeof items>();

	for (const item of items) {
		if (item.groupId != null) {
			const groupItems = groupedItems.get(item.groupId) ?? [];
			groupItems.push(item);
			groupedItems.set(item.groupId, groupItems);
		}
	}

	const data = [
		...groups.toSorted(comparePosition).map((group) => {
			return {
				id: group.id,
				label: group.label,
				type: "group" as const,
				items: (groupedItems.get(group.id) ?? []).toSorted(comparePosition),
			};
		}),
		...items
			.filter((item) => item.groupId == null)
			.toSorted(comparePosition)
			.map((item) => {
				return { ...item, type: "item" as const };
			}),
	].map((node) => {
		if (node.type === "item") {
			const { groupId: _groupId, position: _position, ...item } = node;
			return { ...flattenEntityVersion(item), type: "item" as const };
		}

		return {
			...node,
			items: node.items.map((item) => {
				const { groupId: _groupId, position: _itemPosition, ...rest } = item;
				return { ...flattenEntityVersion(rest), type: "item" as const };
			}),
		};
	});

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
						entity: {
							columns: { slug: true },
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
}

export async function getDocumentOrPolicySlugs(
	db: Database | Transaction,
	params: GetDocumentOrPolicySlugsParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.documentsPolicies.findMany({
			where: {
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
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true },
						},
					},
				},
			},
			orderBy(t, { desc, sql }) {
				return [desc(sql`"entityVersion"."r" ->> 'updatedAt'`)];
			},
			limit,
			offset,
		}),
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

	const data = items.map(({ id, entityVersion }) => {
		return { id, entity: { slug: entityVersion.entity.slug } };
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
	slug: schema.Entity["slug"];
}

export async function getDocumentOrPolicyBySlug(
	db: Database | Transaction,
	params: GetDocumentOrPolicyBySlugParams,
) {
	const { slug } = params;

	const item = await db.query.documentsPolicies.findFirst({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
				entity: {
					slug,
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
					entity: {
						columns: { slug: true },
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
