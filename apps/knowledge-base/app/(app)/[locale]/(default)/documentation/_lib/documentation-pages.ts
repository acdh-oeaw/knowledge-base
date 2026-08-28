import { assert } from "@acdh-oeaw/lib";
import { cache } from "react";

import { db } from "@/lib/db";

/**
 * The overview page is authored in the dashboard like every other documentation page, under this
 * slug. `/documentation` renders it, so it has no address of its own — `/documentation/overview`
 * redirects to the index rather than serving the same content twice.
 *
 * Nothing creates the page: when no page carries this slug the index falls back to a plain listing,
 * so the section works before an editor writes an introduction and improves once they do.
 */
export const documentationOverviewSlug = "overview";

export interface PublishedDocumentationPage {
	/** The entity version id, which is what content blocks hang off. */
	id: string;
	slug: string;
	title: string;
}

/**
 * Every published documentation page, alphabetically — the order the navigation lists them in.
 *
 * Cached per request because the layout needs the list for the navigation and the index page needs
 * it again for its fallback listing.
 */
export const getPublishedDocumentationPages = cache(
	async function getPublishedDocumentationPages(): Promise<Array<PublishedDocumentationPage>> {
		const pages = await db.query.documentationPages.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
			},
			columns: {
				id: true,
				title: true,
			},
			with: {
				entityVersion: {
					columns: {},
					with: {
						slug: {
							columns: {
								value: true,
							},
						},
					},
				},
			},
			orderBy: {
				title: "asc",
			},
		});

		return pages.map((page) => {
			assert(page.entityVersion.slug, `Slug missing for entity version "${page.id}".`);
			return { id: page.id, slug: page.entityVersion.slug.value, title: page.title };
		});
	},
);

/**
 * The published documentation page under `slug`, or `null` when there is none.
 *
 * Returns `null` rather than calling `notFound`, because a missing page is not always an error —
 * the index asks for the overview page and falls back when it is absent.
 */
export const getPublishedDocumentationPage = cache(async function getPublishedDocumentationPage(
	slug: string,
): Promise<{ id: string; title: string } | null> {
	const page = await db.query.documentationPages.findFirst({
		where: {
			entityVersion: {
				slug: {
					value: slug,
				},
				status: {
					type: "published",
				},
			},
		},
		columns: {
			id: true,
			title: true,
		},
	});

	return page ?? null;
});
