import { OpportunityUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const UpdateOpportunityActionInputSchema = v.object({
	documentId: v.pipe(v.string(), v.uuid()),
	...v.pick(OpportunityUpdateSchema, ["title", "summary", "sourceId", "website"]).entries,
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	duration: v.object({
		start: v.pipe(v.string(), v.isoDate(), v.toDate()),
		end: v.optional(v.pipe(v.string(), v.isoDate(), v.toDate())),
	}),
	website: v.nullish(v.pipe(v.string(), v.url()), null),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
