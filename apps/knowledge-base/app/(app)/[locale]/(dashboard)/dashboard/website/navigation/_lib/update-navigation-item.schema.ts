import { NavigationItemSelectSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

export const UpdateNavigationItemActionInputSchema = v.pipe(
	v.object({
		...v.pick(NavigationItemSelectSchema, ["id", "label"]).entries,
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
