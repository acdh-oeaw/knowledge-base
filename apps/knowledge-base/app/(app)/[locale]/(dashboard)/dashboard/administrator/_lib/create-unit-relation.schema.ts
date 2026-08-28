import * as v from "valibot";

import { OptionalRelationDescriptionSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/relation-description.schema";

export const CreateUnitRelationActionInputSchema = v.object({
	unitDocumentId: v.pipe(v.string(), v.uuid()),
	statusId: v.pipe(v.string(), v.uuid()),
	relatedUnitDocumentId: v.pipe(v.string(), v.uuid()),
	duration: v.object({
		start: v.pipe(v.string(), v.isoDate(), v.toDate()),
		end: v.optional(v.pipe(v.string(), v.isoDate(), v.toDate())),
	}),
	description: OptionalRelationDescriptionSchema,
});
