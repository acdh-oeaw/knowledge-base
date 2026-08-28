import {
	DocumentationPageSelectSchema,
	DocumentationPageUpdateSchema,
} from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";

export const UpdateDocumentationPageActionInputSchema = v.object({
	slug: EntitySlugInputSchema,
	...v.pick(DocumentationPageSelectSchema, ["id"]).entries,
	...v.pick(DocumentationPageUpdateSchema, ["title"]).entries,
	documentId: v.pipe(v.string(), v.uuid()),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
