/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl } from "@/lib/images";
import type { Database, Transaction } from "@/middlewares/db";
import { imageWidth } from "~/config/api.config";

export async function getFeaturedEntities(db: Database | Transaction) {
	const metadata = await db.query.siteMetadata.findFirst({
		columns: {
			featuredItemIds: true,
		},
	});

	const featuredItemIds = (metadata?.featuredItemIds ?? []) as Array<string>;

	if (featuredItemIds.length === 0) {
		return { data: { news: [] } };
	}

	const items = await db.query.news.findMany({
		where: {
			id: {
				in: featuredItemIds,
			},
			entityVersion: {
				status: {
					type: "published",
				},
			},
		},
		columns: {
			id: true,
			title: true,
			summary: true,
		},
		with: {
			entityVersion: {
				columns: { updatedAt: true },
				with: {
					entity: {
						columns: { slug: true },
					},
				},
			},
			image: {
				columns: {
					key: true,
					alt: true,
					caption: true,
				},
				with: {
					license: {
						columns: {
							name: true,
							url: true,
						},
					},
				},
			},
		},
	});

	const itemsById = new Map(items.map((item) => [item.id, item]));

	const news = featuredItemIds
		.map((id) => itemsById.get(id))
		.filter((item): item is NonNullable<typeof item> => item != null)
		.map((item) => {
			const image = generateImageUrl(item.image, imageWidth.preview);

			return { ...flattenEntityVersion(item), image };
		});

	return { data: { news } };
}
