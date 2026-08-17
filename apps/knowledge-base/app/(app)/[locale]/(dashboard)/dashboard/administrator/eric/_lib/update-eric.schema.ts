import {
	OrganisationalUnitSelectSchema,
	OrganisationalUnitUpdateSchema,
} from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockInputSchema } from "@/lib/content-block-input";

export const UpdateEricActionInputSchema = v.object({
	...v.pick(OrganisationalUnitSelectSchema, ["id"]).entries,
	...v.pick(OrganisationalUnitUpdateSchema, ["name", "summary"]).entries,
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	acronym: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	ror: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	sshocMarketplaceActorId: v.nullish(
		v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		null,
	),
	documentId: v.pipe(v.string(), v.uuid()),
	imageKey: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	descriptionContentBlocks: v.optional(
		v.array(v.pipe(v.string(), v.parseJson(), ContentBlockInputSchema)),
		[],
	),
	relatedEntityIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
	relatedResourceIds: v.optional(v.array(v.pipe(v.string(), v.nonEmpty())), []),
	socialMediaIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
});
