/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";
import { assert } from "@acdh-oeaw/lib";

import { resolveLocaleContext } from "@/lib/locales";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, asc, eq, isNotNull, isNull, or, sql } from "@/services/db/sql";

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

/**
 * Resolve, per linked entity (of any type), the published version to prefer: the requested/default
 * locale's published version, falling back to the default locale's when the document has no version
 * in the preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still
 * works correctly here — both joins target the same locale and `COALESCE` just picks the
 * (identical) match.
 */
async function resolvePublishedNavigationLookup(
  db: Database | Transaction,
  requestedLocaleId?: string,
) {
  const [{ localeId, defaultLocaleId }, status] = await Promise.all([
    resolveLocaleContext(db, requestedLocaleId),
    db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
  ]);

  assert(status, "No published entity status in database.");

  const preferredVersion = alias(schema.entityVersions, "nav_preferred_version");
  const defaultVersion = alias(schema.entityVersions, "nav_default_version");

  return { localeId, defaultLocaleId, statusId: status.id, preferredVersion, defaultVersion };
}

interface GetNavigationParams {
  menu?: string;
  localeId?: string;
}

export async function getNavigation(db: Database | Transaction, params: GetNavigationParams) {
  const { menu, localeId: requestedLocaleId } = params;
  const { localeId, defaultLocaleId, statusId, preferredVersion, defaultVersion } =
    await resolvePublishedNavigationLookup(db, requestedLocaleId);

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
      entitySlug: schema.slugs.value,
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
    .leftJoin(
      schema.entityVersions,
      sql`${schema.entityVersions.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
    )
    .leftJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
    .leftJoin(
      schema.organisationalUnits,
      eq(schema.entityVersions.id, schema.organisationalUnits.id),
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
          isNotNull(schema.entityVersions.id),
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
