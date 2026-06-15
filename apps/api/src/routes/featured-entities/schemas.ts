import * as v from "valibot";

import { NewsItemBaseSchema } from "@/routes/news/schemas";

export const FeaturedEntitiesSchema = v.pipe(
	v.object({
		news: v.array(NewsItemBaseSchema),
	}),
	v.description("Featured entities grouped by type"),
	v.metadata({ ref: "FeaturedEntities" }),
);

export type FeaturedEntities = v.InferOutput<typeof FeaturedEntitiesSchema>;

export const GetFeaturedEntities = {
	ResponseSchema: v.pipe(
		v.object({
			data: FeaturedEntitiesSchema,
		}),
		v.description("Featured entities"),
		v.metadata({ ref: "GetFeaturedEntitiesResponse" }),
	),
};
