import { FundingCallUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const UpdateFundingCallActionInputSchema = v.object({
	documentId: v.pipe(v.string(), v.uuid()),
	...v.pick(FundingCallUpdateSchema, ["title", "summary"]).entries,
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	duration: v.object({
		start: v.pipe(v.string(), v.isoDate(), v.toDate()),
		end: v.optional(v.pipe(v.string(), v.isoDate(), v.toDate())),
	}),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
