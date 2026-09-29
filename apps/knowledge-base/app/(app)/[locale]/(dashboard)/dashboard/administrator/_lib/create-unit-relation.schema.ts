import * as v from "valibot";

import { DurationInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/duration-input.schema";
import { OptionalRelationDescriptionSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/relation-description.schema";

export const CreateUnitRelationActionInputSchema = v.object({
	unitDocumentId: v.pipe(v.string(), v.uuid()),
	statusId: v.pipe(v.string(), v.uuid()),
	relatedUnitDocumentId: v.pipe(v.string(), v.uuid()),
	duration: DurationInputSchema,
	description: OptionalRelationDescriptionSchema,
});
