import { PersonUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const UpdatePersonActionInputSchema = v.object({
	documentId: v.pipe(v.string(), v.uuid()),
	...v.pick(PersonUpdateSchema, ["name", "sortName"]).entries,
	email: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	orcid: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	imageKey: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	biographyContentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
