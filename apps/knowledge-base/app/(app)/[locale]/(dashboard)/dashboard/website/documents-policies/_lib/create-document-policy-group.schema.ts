import { DocumentPolicyGroupInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

export const CreateDocumentPolicyGroupActionInputSchema = v.object({
	...v.pick(DocumentPolicyGroupInsertSchema, ["label"]).entries,
});
