import * as v from "valibot";

export const UpdateFeaturedItemsActionInputSchema = v.object({
	featuredNewsIds: v.optional(v.array(v.string()), []),
	featuredEventIds: v.optional(v.array(v.string()), []),
});
