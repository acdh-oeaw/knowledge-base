import { ProjectUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";

export const UpdateProjectActionInputSchema = v.object({
	slug: EntitySlugInputSchema,
	documentId: v.pipe(v.string(), v.uuid()),
	...v.pick(ProjectUpdateSchema, ["name", "scopeId"]).entries,
	acronym: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	call: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	duration: v.object({
		start: v.pipe(v.string(), v.isoDate(), v.toDate()),
		end: v.optional(v.pipe(v.string(), v.isoDate(), v.toDate())),
	}),
	funding: v.nullish(v.pipe(v.string(), v.toNumber(), v.minValue(0)), null),
	topic: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	imageKey: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	descriptionContentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	socialMediaIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
});
