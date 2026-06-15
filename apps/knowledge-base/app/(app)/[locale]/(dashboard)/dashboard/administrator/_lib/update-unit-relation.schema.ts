import * as v from "valibot";

import { CreateUnitRelationActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-unit-relation.schema";

export const UpdateUnitRelationActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	...CreateUnitRelationActionInputSchema.entries,
});
