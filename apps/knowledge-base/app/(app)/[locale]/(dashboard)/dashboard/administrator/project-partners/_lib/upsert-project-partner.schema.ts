import * as v from "valibot";

export const UpsertProjectPartnerActionInputSchema = v.object({
	id: v.optional(v.pipe(v.string(), v.uuid())),
	projectDocumentId: v.pipe(v.string(), v.uuid()),
	unitDocumentId: v.pipe(v.string(), v.uuid()),
	roleId: v.pipe(v.string(), v.uuid()),
	duration: v.optional(
		v.object({
			start: v.pipe(v.string(), v.isoDate(), v.toDate()),
			end: v.optional(v.pipe(v.string(), v.isoDate(), v.toDate())),
		}),
	),
});
