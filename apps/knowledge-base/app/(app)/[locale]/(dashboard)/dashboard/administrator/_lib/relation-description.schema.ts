import * as v from "valibot";

/** Optional free-text relation description; trimmed, with empty input normalised to `null`. */
export const OptionalRelationDescriptionSchema = v.pipe(
	v.optional(v.string()),
	v.transform((value) => {
		const trimmed = value?.trim();

		return trimmed != null && trimmed !== "" ? trimmed : null;
	}),
);
