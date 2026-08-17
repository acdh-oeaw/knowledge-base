import { ProjectInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const CreateProjectActionInputSchema = v.object({
	...v.pick(ProjectInsertSchema, ["acronym", "call", "name", "scopeId", "summary", "topic"])
		.entries,
	funding: v.optional(v.pipe(v.string(), v.toNumber(), v.minValue(0))),
	duration: v.object({
		start: v.pipe(v.string(), v.isoDate(), v.toDate()),
		end: v.optional(v.pipe(v.string(), v.isoDate(), v.toDate())),
	}),
	imageKey: v.optional(v.pipe(v.string(), v.nonEmpty())),
	descriptionContentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
