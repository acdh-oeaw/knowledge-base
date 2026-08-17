import { ImpactCaseStudyUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const UpdateImpactCaseStudyActionInputSchema = v.object({
	documentId: v.pipe(v.string(), v.uuid()),
	...v.pick(ImpactCaseStudyUpdateSchema, ["title"]).entries,
	...v.pick(ImpactCaseStudyUpdateSchema, ["summary"]).entries,
	imageKey: v.pipe(v.string(), v.nonEmpty()),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
});
