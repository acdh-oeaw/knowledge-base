import * as v from "valibot";

import { DurationInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/duration-input.schema";
import { OptionalRelationDescriptionSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/relation-description.schema";

export const CreateContributionActionInputSchema = v.object({
	personDocumentId: v.pipe(v.string(), v.uuid()),
	roleTypeId: v.pipe(v.string(), v.uuid()),
	organisationalUnitDocumentId: v.pipe(v.string(), v.uuid()),
	duration: DurationInputSchema,
	description: OptionalRelationDescriptionSchema,
});
