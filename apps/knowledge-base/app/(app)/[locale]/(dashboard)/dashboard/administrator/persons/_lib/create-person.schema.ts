import { PersonInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";
import { EntitySlugInputSchema } from "@/lib/entity-slug-input";
import { FeaturedImageCaptionInputSchema } from "@/lib/featured-image-input";
import { PersonSocialMediaInputSchema } from "@/lib/person-social-media-input";

export const CreatePersonActionInputSchema = v.object({
	...v.pick(PersonInsertSchema, ["email", "name", "orcid", "sortName"]).entries,
	slug: EntitySlugInputSchema,
	imageKey: v.optional(v.pipe(v.string(), v.nonEmpty())),
	...FeaturedImageCaptionInputSchema,
	...PersonSocialMediaInputSchema,
	biographyContentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
});
