import { OpportunityUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { DurationInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/duration-input.schema";
import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";
import { FeaturedImageInputSchema } from "@/lib/featured-image-input";

export const UpdateOpportunityActionInputSchema = v.object({
	slug: EntitySlugInputSchema,
	documentId: v.pipe(v.string(), v.uuid()),
	localeId: v.pipe(v.string(), v.uuid()),
	...v.pick(OpportunityUpdateSchema, ["title", "summary", "sourceId", "website"]).entries,
	...FeaturedImageInputSchema,
	showTableOfContents: v.pipe(
		v.optional(v.string(), "false"),
		v.transform((s) => s === "true"),
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
	duration: DurationInputSchema,
	website: v.nullish(v.pipe(v.string(), v.url()), null),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
