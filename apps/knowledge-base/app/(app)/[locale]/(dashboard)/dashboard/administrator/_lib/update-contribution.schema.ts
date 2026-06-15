import * as v from "valibot";

import { CreateContributionActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-contribution.schema";

export const UpdateContributionActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	...CreateContributionActionInputSchema.entries,
});
