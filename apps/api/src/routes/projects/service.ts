/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { serializeDateRange } from "@/lib/date-range";
import { flattenEntityVersion } from "@/lib/entity-version";
import { generateImageUrl } from "@/lib/images";
import { getPublishedProjectPartners } from "@/lib/project-partners";
import type { Database, Transaction } from "@/middlewares/db";
import { count, eq, not, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

interface GetProjectsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	status?: "active" | "inactive";
}

export async function getProjects(db: Database | Transaction, params: GetProjectsParams) {
	const { limit = 10, offset = 0, status } = params;

	const [items, aggregate] = await Promise.all([
		db.query.projects.findMany({
			where: {
				entityVersion: {
					status: {
						type: "published",
					},
				},
				RAW:
					status != null
						? (t) => {
								const durationContainsNow = sql`${t.duration} @> NOW()::TIMESTAMPTZ`;
								return status === "active" ? durationContainsNow : not(durationContainsNow);
							}
						: undefined,
			},
			columns: {
				id: true,
				name: true,
				acronym: true,
				summary: true,
				duration: true,
				call: true,
				topic: true,
				funding: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true, id: true },
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
				scope: {
					columns: {
						scope: true,
					},
				},
				socialMedia: {
					columns: {
						id: true,
						url: true,
					},
					with: {
						type: {
							columns: {
								type: true,
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
			.from(schema.projects)
			.innerJoin(schema.entityVersions, eq(schema.projects.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(
				status != null
					? status === "active"
						? sql`${schema.projects.duration} @> NOW()::TIMESTAMPTZ`
						: not(sql`${schema.projects.duration} @> NOW()::TIMESTAMPTZ`)
					: undefined,
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		const image = generateImageUrl(item.image, imageWidth.preview);

		const duration = serializeDateRange(item.duration);

		const socialMedia = item.socialMedia.map((sm) => {
			return {
				...sm,
				type: sm.type.type,
			};
		});

		return {
			...flattenEntityVersion(item),
			duration,
			image,
			socialMedia,
		};
	});

	return { data, limit, offset, total };
}

//

interface GetProjectByIdParams {
	id: schema.Project["id"];
}

export async function getProjectById(db: Database | Transaction, params: GetProjectByIdParams) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.projects.findFirst({
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
				acronym: true,
				summary: true,
				duration: true,
				call: true,
				topic: true,
				funding: true,
			},
			with: {
				entityVersion: {
					columns: { updatedAt: true },
					with: {
						entity: {
							columns: { slug: true, id: true },
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
				scope: {
					columns: {
						scope: true,
					},
				},
				socialMedia: {
					columns: {
						id: true,
						url: true,
					},
					with: {
						type: {
							columns: {
								type: true,
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

	const image = generateImageUrl(item.image, imageWidth.featured);

	const duration = serializeDateRange(item.duration);

	const socialMedia = item.socialMedia.map((sm) => {
		return {
			...sm,
			type: sm.type.type,
		};
	});

	const projectPartners = await getPublishedProjectPartners(db, item.entityVersion.entity.id);
	const rest = flattenEntityVersion(item);

	const funders = projectPartners
		.filter((r) => r.role.role === "funder")
		.map((r) => {
			return { ...r.unit, role: r.role.role };
		});
	const partners = projectPartners
		.filter((r) => r.role.role !== "funder")
		.map((r) => {
			return { ...r.unit, role: r.role.role };
		});

	return {
		...rest,
		duration,
		image,
		socialMedia,
		funders,
		partners,
		...fields,
	};
}

//

interface GetProjectSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getProjectSlugs(db: Database | Transaction, params: GetProjectSlugsParams) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.projects.findMany({
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
							columns: { slug: true, id: true },
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
			.from(schema.projects)
			.innerJoin(schema.entityVersions, eq(schema.projects.id, schema.entityVersions.id))
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

interface GetProjectBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getProjectBySlug(db: Database | Transaction, params: GetProjectBySlugParams) {
	const { slug } = params;

	const item = await db.query.projects.findFirst({
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
			acronym: true,
			summary: true,
			duration: true,
			call: true,
			topic: true,
			funding: true,
		},
		with: {
			entityVersion: {
				columns: { updatedAt: true },
				with: {
					entity: {
						columns: { slug: true, id: true },
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
			scope: {
				columns: {
					scope: true,
				},
			},
			socialMedia: {
				columns: {
					id: true,
					url: true,
				},
				with: {
					type: {
						columns: {
							type: true,
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

	const socialMedia = item.socialMedia.map((sm) => {
		return {
			...sm,
			type: sm.type.type,
		};
	});

	const duration = serializeDateRange(item.duration);

	const fields = await getContentBlocks(db, item.id);

	const projectPartners = await getPublishedProjectPartners(db, item.entityVersion.entity.id);
	const rest = flattenEntityVersion(item);

	const funders = projectPartners
		.filter((r) => r.role.role === "funder")
		.map((r) => {
			return { ...r.unit, role: r.role.role };
		});
	const partners = projectPartners
		.filter((r) => r.role.role !== "funder")
		.map((r) => {
			return { ...r.unit, role: r.role.role };
		});

	return {
		...rest,
		duration,
		image,
		socialMedia,
		funders,
		partners,
		...fields,
	};
}
