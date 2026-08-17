import { NavigationMenuInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

export const CreateNavigationMenuActionInputSchema = v.object({
	...v.pick(NavigationMenuInsertSchema, ["name"]).entries,
});
