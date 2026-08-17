import { DocumentOrPolicyUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const UpdateDocumentOrPolicyActionInputSchema = v.object({
	documentId: v.pipe(v.string(), v.uuid()),
	...v.pick(DocumentOrPolicyUpdateSchema, ["title"]).entries,
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	url: v.nullish(v.pipe(v.string(), v.url()), null),
	groupId: v.optional(v.pipe(v.string(), v.uuid())),
	documentKey: v.pipe(v.string(), v.nonEmpty()),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
