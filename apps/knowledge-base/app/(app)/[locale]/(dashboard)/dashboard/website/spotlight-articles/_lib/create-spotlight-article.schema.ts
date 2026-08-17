import { SpotlightArticleInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const CreateSpotlightArticleActionInputSchema = v.object({
	...v.pick(SpotlightArticleInsertSchema, ["title", "summary"]).entries,
	imageKey: v.pipe(v.string(), v.nonEmpty()),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
});
