import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";

import { CalendarDateSchema, PaginatedResponseSchema, PaginationQuerySchema } from "@/lib/schemas";

export const SocialMediaSchema = v.pipe(
	v.object({
		...v.pick(schema.SocialMediaSelectSchema, ["id", "name", "url"]).entries,
		duration: v.nullable(
			v.object({
				start: CalendarDateSchema,
				end: v.nullable(CalendarDateSchema),
			}),
		),
		type: v.picklist(schema.socialMediaTypesEnum),
		organisationalUnits: v.array(
			v.object({
				...v.pick(schema.OrganisationalUnitSelectSchema, ["id", "name"]).entries,
				type: v.picklist(schema.organisationalUnitTypesEnum),
			}),
		),
	}),
	v.description("Social media"),
	v.metadata({ ref: "SocialMedia" }),
);

export type SocialMedia = v.InferOutput<typeof SocialMediaSchema>;

export const SocialMediaListSchema = v.pipe(
	v.array(SocialMediaSchema),
	v.description("List of social media"),
	v.metadata({ ref: "SocialMediaList" }),
);

export type SocialMediaList = v.InferOutput<typeof SocialMediaListSchema>;

export const GetSocialMediaList = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: SocialMediaListSchema,
		}),
		v.description("Paginated list of social media"),
		v.metadata({ ref: "GetSocialMediaListResponse" }),
	),
};

export const GetSocialMediaById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get social media by id params"),
		v.metadata({ ref: "GetSocialMediaByIdParams" }),
	),
	ResponseSchema: SocialMediaSchema,
};
