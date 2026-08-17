import { articleContributorRolesEnum } from "@dariah-eric/database/schema";
import * as v from "valibot";

export const CreateSpotlightArticleContributorActionInputSchema = v.object({
	articleId: v.pipe(v.string(), v.uuid()),
	personId: v.pipe(v.string(), v.uuid()),
	role: v.picklist(articleContributorRolesEnum),
});
