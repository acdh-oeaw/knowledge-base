import * as v from "valibot";

import { PaginatedResponseSchema, PaginationQuerySchema } from "@/lib/schemas";

export const NewsletterSchema = v.pipe(
	v.object({
		id: v.string(),
		subject_line: v.string(),
		send_time: v.nullable(v.string()),
		archive_url: v.string(),
		status: v.string(),
	}),
	v.description("Newsletter campaign"),
	v.metadata({ ref: "Newsletter" }),
);

export type Newsletter = v.InferOutput<typeof NewsletterSchema>;

export const NewsletterListSchema = v.pipe(
	v.array(NewsletterSchema),
	v.description("List of newsletter campaigns"),
	v.metadata({ ref: "NewsletterList" }),
);

export type NewsletterList = v.InferOutput<typeof NewsletterListSchema>;

export const GetNewsletters = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: NewsletterListSchema,
		}),
		v.description("Paginated list of newsletter campaigns"),
		v.metadata({ ref: "GetNewslettersResponse" }),
	),
};

export const SubscribeNewsletterRequestSchema = v.pipe(
	v.object({
		email: v.pipe(v.string(), v.email()),
	}),
	v.description("Newsletter subscription request"),
	v.metadata({ ref: "SubscribeNewsletterRequest" }),
);

export type SubscribeNewsletterRequest = v.InferOutput<typeof SubscribeNewsletterRequestSchema>;

export const SubscribeNewsletterResponseSchema = v.pipe(
	v.object({
		email: v.pipe(v.string(), v.email()),
	}),
	v.description("Newsletter subscription response"),
	v.metadata({ ref: "SubscribeNewsletterResponse" }),
);

export type SubscribeNewsletterResponse = v.InferOutput<typeof SubscribeNewsletterResponseSchema>;

export const SubscribeNewsletter = {
	RequestSchema: SubscribeNewsletterRequestSchema,
	ResponseSchema: SubscribeNewsletterResponseSchema,
};
