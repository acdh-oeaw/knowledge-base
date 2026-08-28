import * as v from "valibot";

/**
 * Which open relations to close, and on what date.
 *
 * The ids are sent explicitly rather than re-derived on the server, because the review step lets
 * the admin uncheck rows: a relation that genuinely outlives the unit stays open, and only what
 * they confirmed is written.
 */
export const RetireUnitActionInputSchema = v.object({
	unitDocumentId: v.pipe(v.string(), v.uuid()),
	end: v.pipe(v.string(), v.isoDate(), v.toDate()),
	unitRelationIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	personRelationIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
});
