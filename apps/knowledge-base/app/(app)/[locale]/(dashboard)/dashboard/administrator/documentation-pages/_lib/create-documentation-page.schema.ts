import { DocumentationPageInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const CreateDocumentationPageActionInputSchema = v.object({
	...v.pick(DocumentationPageInsertSchema, ["title"]).entries,
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
