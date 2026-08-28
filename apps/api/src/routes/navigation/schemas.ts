import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";

import { EntityRefSchema, LocaleQuerySchema } from "@/lib/schemas";

const NavigationItemBaseSchema = v.object({
	...v.pick(schema.NavigationItemSelectSchema, ["id", "label", "href", "isExternal", "position"])
		.entries,
	/** Null for external links and for items whose href is typed in by hand. */
	entity: v.nullable(EntityRefSchema),
});

const NavigationItemSchema = v.pipe(
	v.object({
		...NavigationItemBaseSchema.entries,
		children: v.array(NavigationItemBaseSchema),
	}),
	v.description("Navigation item"),
	v.metadata({ ref: "NavigationItem" }),
);

export const NavigationMenuSchema = v.pipe(
	v.object({
		...v.pick(schema.NavigationMenuSelectSchema, ["id", "name"]).entries,
		items: v.array(NavigationItemSchema),
	}),
	v.description("Navigation menu"),
	v.metadata({ ref: "NavigationMenu" }),
);

export type NavigationMenu = v.InferOutput<typeof NavigationMenuSchema>;

export const NavigationMenuListSchema = v.pipe(
	v.array(NavigationMenuSchema),
	v.description("List of navigation menus"),
	v.metadata({ ref: "NavigationMenuList" }),
);

export type NavigationMenuList = v.InferOutput<typeof NavigationMenuListSchema>;

export const GetNavigation = {
	QuerySchema: v.pipe(
		v.object({
			menu: v.pipe(
				v.optional(v.string()),
				v.description("Filter to a single menu by name; returns every menu when omitted"),
			),
			...LocaleQuerySchema.entries,
		}),
		v.description("Get navigation query params"),
		v.metadata({ ref: "GetNavigationQuery" }),
	),
	ResponseSchema: v.pipe(
		NavigationMenuListSchema,
		v.description("List of navigation menus with items"),
		v.metadata({ ref: "GetNavigationResponse" }),
	),
};
