import { ImpactCaseStudyUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";
import { FeaturedImageInputSchema } from "@/lib/featured-image-input";

export const UpdateImpactCaseStudyActionInputSchema = v.object({
	slug: EntitySlugInputSchema,
	documentId: v.pipe(v.string(), v.uuid()),
	localeId: v.pipe(v.string(), v.uuid()),
	...v.pick(ImpactCaseStudyUpdateSchema, ["title"]).entries,
	...v.pick(ImpactCaseStudyUpdateSchema, ["summary"]).entries,
	publicationDate: v.pipe(v.string(), v.isoDate(), v.toDate()),
	...FeaturedImageInputSchema,
	showTableOfContents: v.pipe(
		v.optional(v.string(), "false"),
		v.transform((s) => s === "true"),
	),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
});
