import * as schema from "@acdh-knowledge-base/database/schema";
import { ensureArray } from "@acdh-oeaw/lib";
import * as v from "valibot";

import { ContentBlockSchema } from "@/lib/content-blocks";
import {
	PaginatedResponseSchema,
	PaginationQuerySchema,
	RelatedEntitiesSchema,
	RelatedResourcesSchema,
} from "@/lib/schemas";

const fundingCallBaseObject = v.object({
	...v.pick(schema.FundingCallSelectSchema, ["id", "title", "summary"]).entries,
	duration: v.object({
		start: v.pipe(v.string(), v.isoTimestamp()),
		end: v.optional(v.pipe(v.string(), v.isoTimestamp())),
	}),
	entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	publishedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const FundingCallBaseSchema = v.pipe(
	fundingCallBaseObject,
	v.description("Funding call"),
	v.metadata({ ref: "FundingCallBase" }),
);

export type FundingCallBase = v.InferOutput<typeof FundingCallBaseSchema>;

export const FundingCallListSchema = v.pipe(
	v.array(FundingCallBaseSchema),
	v.description("List of funding calls"),
	v.metadata({ ref: "FundingCallList" }),
);

export type FundingCallList = v.InferOutput<typeof FundingCallListSchema>;

export const FundingCallSchema = v.pipe(
	v.object({
		...fundingCallBaseObject.entries,
		content: v.optional(v.array(ContentBlockSchema), []),
		relatedEntities: v.optional(RelatedEntitiesSchema, []),
		relatedResources: v.optional(RelatedResourcesSchema, []),
	}),
	v.description("Funding call"),
	v.metadata({ ref: "FundingCall" }),
);

export type FundingCall = v.InferOutput<typeof FundingCallSchema>;

export const FundingCallSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.FundingCallSelectSchema, ["id"]).entries,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	}),
	v.description("Funding call slug"),
	v.metadata({ ref: "FundingCallSlug" }),
);

export type FundingCallSlug = v.InferOutput<typeof FundingCallSlugSchema>;

export const FundingCallSlugListSchema = v.pipe(
	v.array(FundingCallSlugSchema),
	v.description("List of funding call slugs"),
	v.metadata({ ref: "FundingCallSlugList" }),
);

export type FundingCallSlugList = v.InferOutput<typeof FundingCallSlugListSchema>;

export const fundingCallStatusValues = ["upcoming", "open", "closed"] as const;

export type FundingCallStatus = (typeof fundingCallStatusValues)[number];

const FundingCallStatusQuerySchema = v.pipe(
	v.unknown(),
	v.transform(ensureArray),
	v.array(v.picklist(fundingCallStatusValues)),
);

export const FundingCallQuerySchema = v.object({
	...PaginationQuerySchema.entries,
	status: v.pipe(
		v.optional(FundingCallStatusQuerySchema),
		v.description(
			"Filter by funding call status relative to the current time. Can be provided multiple times, e.g. `?status=upcoming&status=open`.",
		),
		v.metadata({ ref: "FundingCallStatusParam" }),
	),
});

export const GetFundingCalls = {
	QuerySchema: FundingCallQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: FundingCallListSchema,
		}),
		v.description("Paginated list of funding calls"),
		v.metadata({ ref: "GetFundingCallsResponse" }),
	),
};

export const GetFundingCallById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get funding call by id params"),
		v.metadata({ ref: "GetFundingCallByIdParams" }),
	),
	ResponseSchema: FundingCallSchema,
};

export const GetFundingCallSlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: FundingCallSlugListSchema,
		}),
		v.description("Paginated list of funding call slugs"),
		v.metadata({ ref: "GetFundingCallSlugsResponse" }),
	),
};

export const GetFundingCallBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get funding call by slug params"),
		v.metadata({ ref: "GetFundingCallBySlugParams" }),
	),
	ResponseSchema: FundingCallSchema,
};
