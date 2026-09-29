import { OpportunityInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { DurationInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/duration-input.schema";
import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";
import { FeaturedImageInputSchema } from "@/lib/featured-image-input";

export const CreateOpportunityActionInputSchema = v.object({
	slug: EntitySlugInputSchema,
	...v.pick(OpportunityInsertSchema, ["title", "summary", "sourceId", "website"]).entries,
	...FeaturedImageInputSchema,
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
	duration: DurationInputSchema,
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
