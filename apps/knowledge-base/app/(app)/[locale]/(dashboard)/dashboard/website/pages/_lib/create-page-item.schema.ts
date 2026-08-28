import { PageInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";
import { FeaturedImageCaptionInputSchema } from "@/lib/featured-image-input";

export const CreatePageItemActionInputSchema = v.object({
	slug: EntitySlugInputSchema,
	...v.pick(PageInsertSchema, ["title", "summary"]).entries,
	publicationDate: v.pipe(v.string(), v.isoDate(), v.toDate()),
	imageKey: v.optional(v.pipe(v.string(), v.nonEmpty())),
	...FeaturedImageCaptionInputSchema,
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
});
