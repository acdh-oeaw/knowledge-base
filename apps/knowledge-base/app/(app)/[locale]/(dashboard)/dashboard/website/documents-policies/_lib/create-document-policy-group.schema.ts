import { DocumentPolicyGroupInsertSchema } from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

export const CreateDocumentPolicyGroupActionInputSchema = v.object({
	...v.pick(DocumentPolicyGroupInsertSchema, ["label"]).entries,
});
