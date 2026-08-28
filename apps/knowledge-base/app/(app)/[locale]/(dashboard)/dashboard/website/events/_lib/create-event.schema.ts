import { EventInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { EventDurationInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_lib/event-duration";
import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";
import { FeaturedImageInputSchema } from "@/lib/featured-image-input";

export const CreateEventActionInputSchema = v.object({
	slug: EntitySlugInputSchema,
	...v.pick(EventInsertSchema, ["title", "summary", "location", "website"]).entries,
	isFullDay: v.pipe(
		v.optional(v.string(), "false"),
		v.transform((s) => s === "true"),
	),
	duration: EventDurationInputSchema,
	...FeaturedImageInputSchema,
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
});
