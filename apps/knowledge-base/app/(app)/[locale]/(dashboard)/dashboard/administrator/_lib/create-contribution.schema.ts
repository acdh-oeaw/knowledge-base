import * as v from "valibot";

export const CreateContributionActionInputSchema = v.object({
	personDocumentId: v.pipe(v.string(), v.uuid()),
	roleTypeId: v.pipe(v.string(), v.uuid()),
	organisationalUnitDocumentId: v.pipe(v.string(), v.uuid()),
	duration: v.object({
		start: v.pipe(v.string(), v.isoDate(), v.toDate()),
		end: v.optional(v.pipe(v.string(), v.isoDate(), v.toDate())),
	}),
});
