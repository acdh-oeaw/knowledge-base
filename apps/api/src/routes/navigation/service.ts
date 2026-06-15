/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import type { Database, Transaction } from "@/middlewares/db";
import { and, asc, eq, isNotNull, isNull, or, sql } from "@/services/db/sql";

interface NavigationItem {
	id: string;
	label: string;
	href: string | null;
	entity: { type: string; slug: string } | null;
	isExternal: boolean;
	position: number;
	parentId: string | null;
}

interface NavigationItemWithChildren extends NavigationItem {
	children: Array<NavigationItemWithChildren>;
}

function buildTree(
	items: Array<NavigationItem>,
	parentId: string | null,
): Array<NavigationItemWithChildren> {
	return (
		items
			.filter((item) => item.parentId === parentId)
			// eslint-disable-next-line unicorn/no-array-sort
			.sort((a, b) => a.position - b.position)
			.map((item) => {
				return {
					...item,
					children: buildTree(items, item.id),
				};
			})
	);
}

interface GetNavigationParams {
	menu?: string;
}

export async function getNavigation(db: Database | Transaction, params: GetNavigationParams) {
	const { menu } = params;

	const rows = await db
		.select({
			menuId: schema.navigationMenus.id,
			menuName: schema.navigationMenus.name,
			itemId: schema.navigationItems.id,
			label: schema.navigationItems.label,
			href: schema.navigationItems.href,
			isExternal: schema.navigationItems.isExternal,
			position: schema.navigationItems.position,
			parentId: schema.navigationItems.parentId,
			entitySlug: schema.entities.slug,
			entityType: sql<string>`
				CASE
					WHEN ${schema.entityTypes.type} = 'organisational_units'
					THEN ${schema.organisationalUnitTypes.type}
					ELSE ${schema.entityTypes.type}
				END
			`.as("entity_type"),
		})
		.from(schema.navigationMenus)
		.leftJoin(schema.navigationItems, eq(schema.navigationMenus.id, schema.navigationItems.menuId))
		.leftJoin(schema.entities, eq(schema.navigationItems.entityId, schema.entities.id))
		.leftJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
		.leftJoin(schema.documentLifecycle, eq(schema.documentLifecycle.documentId, schema.entities.id))
		.leftJoin(
			schema.organisationalUnits,
			eq(schema.documentLifecycle.publishedId, schema.organisationalUnits.id),
		)
		.leftJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.where(
			and(
				menu != null ? eq(schema.navigationMenus.name, menu) : undefined,
				or(
					isNull(schema.navigationItems.id),
					isNull(schema.navigationItems.entityId),
					isNotNull(schema.documentLifecycle.publishedId),
				),
			),
		)
		.orderBy(asc(schema.navigationMenus.name), asc(schema.navigationItems.position));

	const menus = new Map<string, { id: string; name: string; items: Array<NavigationItem> }>();

	for (const row of rows) {
		const item = menus.get(row.menuId) ?? { id: row.menuId, name: row.menuName, items: [] };
		menus.set(row.menuId, item);

		if (row.itemId == null) {
			continue;
		}

		item.items.push({
			id: row.itemId,
			label: row.label!,
			href: row.href ?? null,
			entity:
				row.entitySlug != null && row.entityType != null
					? { type: row.entityType, slug: row.entitySlug }
					: null,
			isExternal: row.isExternal!,
			position: row.position!,
			parentId: row.parentId ?? null,
		});
	}

	return [...menus.values()].map((m) => {
		const tree = buildTree(m.items, null);
		return { id: m.id, name: m.name, items: tree };
	});
}
