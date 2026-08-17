import {
	DocumentOrPolicySelectSchema,
	DocumentOrPolicyUpdateSchema,
} from "@dariah-eric/database/schema";
import * as v from "valibot";

export const UpdateDocumentOrPolicyDetailsActionInputSchema = v.object({
	...v.pick(DocumentOrPolicySelectSchema, ["id"]).entries,
	...v.pick(DocumentOrPolicyUpdateSchema, ["title"]).entries,
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	url: v.nullish(v.pipe(v.string(), v.url()), null),
	groupId: v.optional(v.pipe(v.string(), v.uuid())),
	documentKey: v.pipe(v.string(), v.nonEmpty()),
});
