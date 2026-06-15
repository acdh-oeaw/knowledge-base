/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl } from "@/lib/images";
import { getRelatedEntities, getRelatedResources } from "@/lib/relations";
import type { Database, Transaction } from "@/middlewares/db";
import { count, eq } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

interface GetPagesParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getPages(db: Database | Transaction, params: GetPagesParams) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.pages.findMany({
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
			orderBy(t, { desc, sql }) {
				return [desc(sql`"entityVersion"."r" ->> 'updatedAt'`)];
			},
			limit,
			offset,
		}),
		db
			.select({ total: count() })
			.from(schema.pages)
			.innerJoin(schema.entityVersions, eq(schema.pages.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		const image = generateImageUrl(item.image, imageWidth.preview);

		return { ...flattenEntityVersion(item), image };
	});

	return { data, limit, offset, total };
}

//

interface GetPageByIdParams {
	id: schema.Page["id"];
}

export async function getPageById(db: Database | Transaction, params: GetPageByIdParams) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.pages.findFirst({
			where: {
				id,
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
		}),
		getContentBlocks(db, id),
	]);

	if (item == null) {
		return null;
	}

	const [relatedEntities, relatedResources] = await Promise.all([
		getRelatedEntities(db, id),
		getRelatedResources(db, id),
	]);

	const image = generateImageUrl(item.image, imageWidth.featured);

	return {
		...flattenEntityVersion(item),
		image,
		...fields,
		relatedEntities,
		relatedResources,
	};
}

//

interface GetPageSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getPageSlugs(db: Database | Transaction, params: GetPageSlugsParams) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.pages.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
			},
			columns: {
				id: true,
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
			orderBy(t, { desc, sql }) {
				return [desc(sql`"entityVersion"."r" ->> 'updatedAt'`)];
			},
			limit,
			offset,
		}),
		db
			.select({ total: count() })
			.from(schema.pages)
			.innerJoin(schema.entityVersions, eq(schema.pages.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map(({ id, entityVersion }) => {
		return { id, entity: { slug: entityVersion.entity.slug } };
	});

	return { data, limit, offset, total };
}

//

interface GetPageBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getPageBySlug(db: Database | Transaction, params: GetPageBySlugParams) {
	const { slug } = params;

	const item = await db.query.pages.findFirst({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
				entity: {
					slug,
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

	if (item == null) {
		return null;
	}

	const image = generateImageUrl(item.image, imageWidth.featured);

	const [fields, relatedEntities, relatedResources] = await Promise.all([
		getContentBlocks(db, item.id),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
	]);

	return {
		...flattenEntityVersion(item),
		image,
		...fields,
		relatedEntities,
		relatedResources,
	};
}
