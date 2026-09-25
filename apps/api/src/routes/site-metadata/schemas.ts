import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ImageSchema, LocaleQuerySchema } from "@/lib/schemas";

export const SiteMetadataSchema = v.pipe(
	v.object({
		...v.pick(schema.SiteMetadataTranslationSelectSchema, [
			"title",
			"description",
			"ogTitle",
			"ogDescription",
		]).entries,
		ogImage: v.nullable(ImageSchema),
	}),
	v.description("Site metadata"),
	v.metadata({ ref: "SiteMetadata" }),
);

export type SiteMetadata = v.InferOutput<typeof SiteMetadataSchema>;

export const GetSiteMetadata = {
	QuerySchema: LocaleQuerySchema,
	ResponseSchema: v.pipe(
		SiteMetadataSchema,
		v.description("Site metadata"),
		v.metadata({ ref: "GetSiteMetadataResponse" }),
	),
};
