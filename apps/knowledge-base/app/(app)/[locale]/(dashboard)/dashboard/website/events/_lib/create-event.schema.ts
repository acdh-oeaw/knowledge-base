import { EventInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const CreateEventActionInputSchema = v.object({
	...v.pick(EventInsertSchema, ["title", "summary", "location", "website"]).entries,
	isFullDay: v.pipe(
		v.optional(v.string(), "false"),
		v.transform((s) => s === "true"),
	),
	duration: v.object({
		start: v.pipe(v.string(), v.isoDate(), v.toDate()),
		end: v.optional(v.pipe(v.string(), v.isoDate(), v.toDate())),
	}),
	imageKey: v.pipe(v.string(), v.nonEmpty()),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
});
