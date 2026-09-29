import * as v from "valibot";

import { DurationInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/duration-input.schema";

export const UpsertProjectPartnerActionInputSchema = v.object({
	id: v.optional(v.pipe(v.string(), v.uuid())),
	projectDocumentId: v.pipe(v.string(), v.uuid()),
	unitDocumentId: v.pipe(v.string(), v.uuid()),
	roleId: v.pipe(v.string(), v.uuid()),
	duration: v.optional(DurationInputSchema),
});
