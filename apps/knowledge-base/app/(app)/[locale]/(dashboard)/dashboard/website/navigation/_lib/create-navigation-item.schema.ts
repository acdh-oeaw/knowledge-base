import { NavigationItemInsertSchema } from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

export const CreateNavigationItemActionInputSchema = v.pipe(
	v.object({
		...v.pick(NavigationItemInsertSchema, ["menuId", "label"]).entries,
		parentId: v.optional(v.pipe(v.string(), v.uuid())),
		href: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
		entityId: v.nullish(v.pipe(v.string(), v.uuid()), null),
		isExternal: v.optional(
			v.pipe(
				v.string(),
				v.transform((s) => s === "true"),
			),
		),
	}),
	v.check(
		({ href, entityId }) => !(href != null && entityId != null),
		"A URL and an internal link cannot both be set.",
	),
);
