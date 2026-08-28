import { EventUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { EventDurationInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_lib/event-duration";
import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";
import { FeaturedImageInputSchema } from "@/lib/featured-image-input";

export const UpdateEventActionInputSchema = v.object({
	slug: EntitySlugInputSchema,
	documentId: v.pipe(v.string(), v.uuid()),
	...v.pick(EventUpdateSchema, ["title", "summary", "location", "website"]).entries,
	isFullDay: v.pipe(
		v.optional(v.string(), "false"),
		v.transform((s) => s === "true"),
	),
	duration: EventDurationInputSchema,
	...FeaturedImageInputSchema,
	website: v.nullish(v.pipe(v.string(), v.url()), null),
	contentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
});
