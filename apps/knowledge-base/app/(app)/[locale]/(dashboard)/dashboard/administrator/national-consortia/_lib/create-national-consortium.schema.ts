import { OrganisationalUnitInsertSchema } from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const CreateNationalConsortiumActionInputSchema = v.object({
	...v.pick(OrganisationalUnitInsertSchema, ["name", "summary"]).entries,
	acronym: v.optional(v.pipe(v.string(), v.nonEmpty())),
	ror: v.optional(v.pipe(v.string(), v.nonEmpty())),
	sshocMarketplaceActorId: v.nullish(
		v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		null,
	),
	imageKey: v.optional(v.pipe(v.string(), v.nonEmpty())),
	descriptionContentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
});
