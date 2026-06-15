/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl } from "@/lib/images";
import { getPersonPositions } from "@/lib/persons";
import type { Database, Transaction } from "@/middlewares/db";
import { count, eq } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

interface GetPersonsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getPersons(db: Database | Transaction, params: GetPersonsParams) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.persons.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
			},
			columns: {
				id: true,
				name: true,
				sortName: true,
				email: true,
				orcid: true,
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
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;
	const positions = await getPersonPositions(
		db,
		items.map((item) => item.id),
	);

	const data = items.map((item) => {
		const image = generateImageUrl(item.image, imageWidth.avatar);

		return {
			...flattenEntityVersion(item),
			position: positions.get(item.id) ?? null,
			image,
		};
	});

	return { data, limit, offset, total };
}

//

interface GetPersonByIdParams {
	id: schema.Person["id"];
}

export async function getPersonById(db: Database | Transaction, params: GetPersonByIdParams) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.persons.findFirst({
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
				name: true,
				sortName: true,
				email: true,
				orcid: true,
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

	const positions = await getPersonPositions(db, [item.id]);

	const image = generateImageUrl(item.image, imageWidth.featured);

	return {
		...flattenEntityVersion(item),
		position: positions.get(item.id) ?? null,
		image,
		...fields,
	};
}

//

interface GetPersonSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getPersonSlugs(db: Database | Transaction, params: GetPersonSlugsParams) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.persons.findMany({
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
			},
			orderBy(t, { desc, sql }) {
				return [desc(sql`"entityVersion"."r" ->> 'updatedAt'`)];
			},
			limit,
			offset,
		}),
		db
			.select({ total: count() })
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
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

interface GetPersonBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getPersonBySlug(db: Database | Transaction, params: GetPersonBySlugParams) {
	const { slug } = params;

	const item = await db.query.persons.findFirst({
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
			name: true,
			sortName: true,
			email: true,
			orcid: true,
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

	const positions = await getPersonPositions(db, [item.id]);

	const image = generateImageUrl(item.image, imageWidth.featured);

	const fields = await getContentBlocks(db, item.id);

	return {
		...flattenEntityVersion(item),
		position: positions.get(item.id) ?? null,
		image,
		...fields,
	};
}
