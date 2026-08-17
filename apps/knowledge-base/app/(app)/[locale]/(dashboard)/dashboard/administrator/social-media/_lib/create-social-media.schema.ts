import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";

export const CreateSocialMediaActionInputSchema = v.object({
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
