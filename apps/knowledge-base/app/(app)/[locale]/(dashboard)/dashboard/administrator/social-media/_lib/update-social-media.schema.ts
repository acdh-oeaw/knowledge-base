import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";

import { OpenDurationInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/duration-input.schema";

export const UpdateSocialMediaActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	name: v.pipe(v.string(), v.nonEmpty()),
	url: v.pipe(v.string(), v.nonEmpty(), v.url()),
	type: v.picklist(schema.socialMediaTypesEnum),
	duration: v.optional(OpenDurationInputSchema),
});
