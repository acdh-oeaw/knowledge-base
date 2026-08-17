import { SpotlightArticleUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const UpdateSpotlightArticleActionInputSchema = v.object({
	documentId: v.pipe(v.string(), v.uuid()),
	...v.pick(SpotlightArticleUpdateSchema, ["title"]).entries,
	...v.pick(SpotlightArticleUpdateSchema, ["summary"]).entries,
	imageKey: v.pipe(v.string(), v.nonEmpty()),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
});
