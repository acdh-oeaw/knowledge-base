import { personSocialMediaTypesEnum } from "@dariah-eric/database/schema";
import * as v from "valibot";

/**
 * One row posted by `PersonSocialMediaFields`. Order in the array becomes
 * `person_social_media.position`, so no position is submitted. An empty input is dropped before
 * validation (see `getFormDataValues`), so an untouched `label` arrives as `undefined` rather than
 * an empty string.
 */
export const PersonSocialMediaEntryInputSchema = v.object({
	type: v.picklist(personSocialMediaTypesEnum),
	url: v.pipe(v.string(), v.nonEmpty(), v.url()),
	label: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
});

export type PersonSocialMediaEntryInput = v.InferOutput<typeof PersonSocialMediaEntryInputSchema>;

/**
 * The submitted social media of a person. Urls must be distinct, which `person_social_media` also
 * enforces with a unique constraint — checking it here turns what would be a constraint violation
 * into a field error.
 */
export const PersonSocialMediaInputSchema = {
	socialMedia: v.optional(
		v.pipe(
			v.array(PersonSocialMediaEntryInputSchema),
			v.check(
				(entries) => new Set(entries.map((entry) => entry.url)).size === entries.length,
				"Each entry must have a distinct url.",
			),
		),
		[],
	),
};
