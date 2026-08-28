import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";

/**
 * Input for the inline "Create social media" modal offered by `SocialMediaRelationsFields`, i.e.
 * the social media section of every entity form that has one. Kept in sync with the standalone
 * admin form's `CreateSocialMediaActionInputSchema`: both write the same `social_media` row, so a
 * url that one accepts the other must accept too.
 */
export const CreateSocialMediaSchema = v.object({
	name: v.pipe(v.string(), v.nonEmpty()),
	url: v.pipe(v.string(), v.nonEmpty(), v.url()),
	type: v.picklist(schema.socialMediaTypesEnum),
	duration: v.optional(
		v.object({
			start: v.optional(v.pipe(v.string(), v.isoDate(), v.toDate())),
			end: v.optional(v.pipe(v.string(), v.isoDate(), v.toDate())),
		}),
	),
});
