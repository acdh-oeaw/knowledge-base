import { OrganisationalUnitUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";

export const UpdateWorkingGroupActionInputSchema = v.object({
	slug: EntitySlugInputSchema,
	documentId: v.pipe(v.string(), v.uuid()),
	...v.pick(OrganisationalUnitUpdateSchema, ["name", "summary"]).entries,
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	acronym: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	email: v.nullish(v.pipe(v.string(), v.email()), null),
	mailingList: v.nullish(
		v.union(
			[v.pipe(v.string(), v.email()), v.pipe(v.string(), v.url())],
			"Enter a valid email address or URL.",
		),
		null,
	),
	sshocMarketplaceActorId: v.nullish(
		v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		null,
	),
	imageKey: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	descriptionContentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
	socialMediaIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
});
