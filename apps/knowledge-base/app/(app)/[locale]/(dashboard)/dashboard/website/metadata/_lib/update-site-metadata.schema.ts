import * as v from "valibot";

export const UpdateSiteMetadataActionInputSchema = v.object({
	title: v.pipe(v.string(), v.nonEmpty()),
	description: v.pipe(v.string(), v.nonEmpty()),
	ogTitle: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	ogDescription: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	imageKey: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	featuredItemIds: v.optional(v.array(v.string()), []),
});
