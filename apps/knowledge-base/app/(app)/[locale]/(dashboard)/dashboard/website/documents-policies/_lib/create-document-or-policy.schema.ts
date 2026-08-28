import { DocumentOrPolicyInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";

export const CreateDocumentOrPolicyActionInputSchema = v.object({
	slug: EntitySlugInputSchema,
	...v.pick(DocumentOrPolicyInsertSchema, ["title"]).entries,
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	url: v.nullish(v.pipe(v.string(), v.url()), null),
	groupId: v.optional(v.pipe(v.string(), v.uuid())),
	documentKey: v.pipe(v.string(), v.nonEmpty()),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
