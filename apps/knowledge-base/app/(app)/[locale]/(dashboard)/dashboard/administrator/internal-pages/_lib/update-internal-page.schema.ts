import { InternalPageSelectSchema, InternalPageUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const UpdateInternalPageActionInputSchema = v.object({
	...v.pick(InternalPageSelectSchema, ["id"]).entries,
	...v.pick(InternalPageUpdateSchema, ["title"]).entries,
	documentId: v.pipe(v.string(), v.uuid()),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
