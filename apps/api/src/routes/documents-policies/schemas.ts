import * as schema from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

import { ContentBlockSchema } from "@/lib/content-blocks";
import { PaginatedResponseSchema, PaginationQuerySchema } from "@/lib/schemas";

const DocumentPolicyGroupSchema = v.nullable(
	v.object({
		...v.pick(schema.DocumentPolicyGroupSelectSchema, ["id", "label", "position"]).entries,
	}),
);

export const DocumentOrPolicyBaseSchema = v.pipe(
	v.object({
		...v.pick(schema.DocumentOrPolicySelectSchema, ["id", "title"]).entries,
		summary: v.nullable(v.string()),
		url: v.nullable(v.string()),
		document: v.object({ url: v.string() }),
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		group: DocumentPolicyGroupSchema,
	}),
	v.description("Document or policy"),
	v.metadata({ ref: "DocumentOrPolicyBase" }),
);

export type DocumentOrPolicyBase = v.InferOutput<typeof DocumentOrPolicyBaseSchema>;

export const DocumentOrPolicyListSchema = v.pipe(
	v.array(DocumentOrPolicyBaseSchema),
	v.description("List of documents and policies"),
	v.metadata({ ref: "DocumentOrPolicyList" }),
);

export type DocumentOrPolicyList = v.InferOutput<typeof DocumentOrPolicyListSchema>;

const { group: _group, ...DocumentOrPolicyTreeItemEntries } = DocumentOrPolicyBaseSchema.entries;

const DocumentOrPolicyTreeItemSchema = v.object({
	...DocumentOrPolicyTreeItemEntries,
	type: v.literal("item"),
});

const DocumentOrPolicyTreeGroupSchema = v.object({
	...v.pick(schema.DocumentPolicyGroupSelectSchema, ["id", "label"]).entries,
	type: v.literal("group"),
	items: v.array(DocumentOrPolicyTreeItemSchema),
});

export const DocumentOrPolicyTreeSchema = v.pipe(
	v.array(v.union([DocumentOrPolicyTreeItemSchema, DocumentOrPolicyTreeGroupSchema])),
	v.description("Ordered tree of documents, policies, and groups"),
	v.metadata({ ref: "DocumentOrPolicyTree" }),
);

export type DocumentOrPolicyTree = v.InferOutput<typeof DocumentOrPolicyTreeSchema>;

export const DocumentOrPolicySchema = v.pipe(
	v.object({
		...v.pick(schema.DocumentOrPolicySelectSchema, ["id", "title"]).entries,
		summary: v.nullable(v.string()),
		url: v.nullable(v.string()),
		document: v.object({ url: v.string() }),
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		description: v.optional(v.array(ContentBlockSchema), []),
		group: DocumentPolicyGroupSchema,
	}),
	v.description("Document or policy"),
	v.metadata({ ref: "DocumentOrPolicy" }),
);

export type DocumentOrPolicy = v.InferOutput<typeof DocumentOrPolicySchema>;

export const DocumentOrPolicySlugSchema = v.pipe(
	v.object({
		...v.pick(schema.DocumentOrPolicySelectSchema, ["id"]).entries,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	}),
	v.description("Document or policy slug"),
	v.metadata({ ref: "DocumentOrPolicySlug" }),
);

export type DocumentOrPolicySlug = v.InferOutput<typeof DocumentOrPolicySlugSchema>;

export const DocumentOrPolicySlugListSchema = v.pipe(
	v.array(DocumentOrPolicySlugSchema),
	v.description("List of document or policy slugs"),
	v.metadata({ ref: "DocumentOrPolicySlugList" }),
);

export type DocumentOrPolicySlugList = v.InferOutput<typeof DocumentOrPolicySlugListSchema>;

export const GetDocumentsPolicies = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: DocumentOrPolicyListSchema,
		}),
		v.description("Paginated list of documents and policies"),
		v.metadata({ ref: "GetDocumentsPoliciesResponse" }),
	),
};

export const GetDocumentsPoliciesTree = {
	ResponseSchema: v.pipe(
		v.object({
			data: DocumentOrPolicyTreeSchema,
		}),
		v.description("Ordered tree of documents, policies, and groups"),
		v.metadata({ ref: "GetDocumentsPoliciesTreeResponse" }),
	),
};

export const GetDocumentOrPolicyById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get document or policy by id params"),
		v.metadata({ ref: "GetDocumentOrPolicyByIdParams" }),
	),
	ResponseSchema: DocumentOrPolicySchema,
};

export const GetDocumentOrPolicySlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: DocumentOrPolicySlugListSchema,
		}),
		v.description("Paginated list of document or policy slugs"),
		v.metadata({ ref: "GetDocumentOrPolicySlugsResponse" }),
	),
};

export const GetDocumentOrPolicyBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get document or policy by slug params"),
		v.metadata({ ref: "GetDocumentOrPolicyBySlugParams" }),
	),
	ResponseSchema: DocumentOrPolicySchema,
};
