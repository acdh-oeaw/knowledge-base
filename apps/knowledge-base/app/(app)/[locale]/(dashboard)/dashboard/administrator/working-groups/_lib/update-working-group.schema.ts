import { OrganisationalUnitUpdateSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const UpdateWorkingGroupActionInputSchema = v.object({
	documentId: v.pipe(v.string(), v.uuid()),
	...v.pick(OrganisationalUnitUpdateSchema, ["name", "summary"]).entries,
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	acronym: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	sshocMarketplaceActorId: v.nullish(
		v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		null,
	),
	imageKey: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	descriptionContentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
	socialMediaIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
});
