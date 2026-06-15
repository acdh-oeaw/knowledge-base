import { DocumentPolicyGroupUpdateSchema } from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

export const UpdateDocumentPolicyGroupActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	...v.pick(DocumentPolicyGroupUpdateSchema, ["label"]).entries,
});
