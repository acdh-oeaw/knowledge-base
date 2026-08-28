import type { JSONContent } from "@tiptap/core";
import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { assets } from "./assets";
import { entities, entityVersions } from "./entities";
import { imageCaptionModeColumn, imageCaptionModesEnum } from "./image-captions";
import { articleContributorRolesEnum } from "./impact-case-studies";

export const spotlightArticles = p.snakeCase.table(
	"spotlight_articles",
	{
		id: p
			.uuid("id")
			.primaryKey()
			.references(() => entityVersions.id),
		title: p.text("title").notNull(),
		summary: p.text("summary").notNull(),
		publicationDate: f.timestamp("publication_date").notNull(),
		imageId: p
			.uuid("image_id")
			.notNull()
			.references(() => assets.id),
		/**
		 * Caption for the featured image at this placement. `inherit` shows the asset's own caption,
		 * `override` shows {@link imageCaption}, `hidden` shows none - the same vocabulary image content
		 * blocks use (see `imageCaptionModesEnum`), so an image reads the same wherever it is placed.
		 */
		imageCaption: p.jsonb("image_caption").$type<JSONContent>(),
		imageCaptionMode: imageCaptionModeColumn("image_caption_mode"),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"spotlight_articles_image_caption_mode_enum_check",
			inArray(t.imageCaptionMode, imageCaptionModesEnum),
		),
	],
);

export type SpotlightArticle = typeof spotlightArticles.$inferSelect;
export type SpotlightArticleInput = typeof spotlightArticles.$inferInsert;

export const SpotlightArticleSelectSchema = createSelectSchema(spotlightArticles);
export const SpotlightArticleInsertSchema = createInsertSchema(spotlightArticles);
export const SpotlightArticleUpdateSchema = createUpdateSchema(spotlightArticles);

/**
 * Document-level relation: a spotlight article's contributors. Both endpoints reference
 * `entities.id` (document ids), not version ids, so a contributor is stable across the
 * draft/publish lifecycle of either side and is never cloned by the lifecycle adapter. Reads
 * resolve each endpoint through its published version.
 */
export const spotlightArticlesToPersons = p.snakeCase.table(
	"spotlight_articles_to_persons",
	{
		spotlightArticleDocumentId: p
			.uuid("spotlight_article_document_id")
			.notNull()
			.references(() => entities.id),
		personDocumentId: p
			.uuid("person_document_id")
			.notNull()
			.references(() => entities.id),
		role: p.text("role", { enum: articleContributorRolesEnum }).notNull().default("author"),
		...f.timestamps(),
	},
	(t) => [
		p.primaryKey({
			columns: [t.spotlightArticleDocumentId, t.personDocumentId],
			name: "spotlight_articles_to_persons_pkey",
		}),
	],
);
