/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { getContentBlocks } from "@/lib/content-blocks";
import { serializeDateRange } from "@/lib/date-range";
import { flattenEntityVersion } from "@/lib/entity-version";
import { type ImageAsset, generateImageUrl } from "@/lib/images";
import {
	getPublishedProjectPartners,
	getPublishedProjectPartnersByDocuments,
} from "@/lib/project-partners";
import { getRelatedEntities, getRelatedResources } from "@/lib/relations";
import type { Database, Transaction } from "@/middlewares/db";
import { count, eq, not, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

function mapItem<
	T extends {
		image: ImageAsset | null;
		socialMedia: Array<{
			id: string;
			url: string;
			type: { type: string };
		}>;
		entityVersion: { updatedAt: Date; entity: { slug: string } };
		duration: { start: Date; end?: Date };
	},
>(item: T, width: number) {
	const image = generateImageUrl(item.image, width);
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
}

//

interface GetDariahProjectsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	status?: "active" | "inactive";
}

export async function getDariahProjects(
	db: Database | Transaction,
	params: GetDariahProjectsParams,
) {
	const { limit = 10, offset = 0, status } = params;

	const [items, aggregate] = await Promise.all([
		db.query.dariahProjects.findMany({
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
			.from(schema.dariahProjects)
			.innerJoin(schema.entityVersions, eq(schema.dariahProjects.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(
				status != null
					? status === "active"
						? sql`${schema.dariahProjects.duration} @> NOW()::TIMESTAMPTZ`
						: not(sql`${schema.dariahProjects.duration} @> NOW()::TIMESTAMPTZ`)
					: undefined,
			),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const partnersByDocument = await getPublishedProjectPartnersByDocuments(
		db,
		items.map((item) => item.entityVersion.entity.id),
	);

	const data = items.map((item) => {
		const partners = partnersByDocument.get(item.entityVersion.entity.id) ?? [];
		const role =
			partners.find((r) => r.unit.type === "eric" && r.unit.slug === "dariah-eu")?.role.role ??
			null;

		return {
			...mapItem(item, imageWidth.preview),
			role,
		};
	});

	return { data, limit, offset, total };
}

//

interface GetDariahProjectByIdParams {
	id: schema.Project["id"];
}

export async function getDariahProjectById(
	db: Database | Transaction,
	params: GetDariahProjectByIdParams,
) {
	const { id } = params;

	const [item, fields] = await Promise.all([
		db.query.dariahProjects.findFirst({
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

	const [relatedEntities, relatedResources] = await Promise.all([
		getRelatedEntities(db, id),
		getRelatedResources(db, id),
	]);

	const projectPartners = await getPublishedProjectPartners(db, item.entityVersion.entity.id);
	const rest = item;

	const participants = projectPartners
		.filter((r) => r.role.role === "participant")
		.map((r) => r.unit);

	const coordinators = projectPartners
		.filter((r) => r.role.role === "coordinator")
		.map((r) => r.unit);

	return {
		...mapItem(rest, imageWidth.featured),
		...fields,
		participants,
		coordinators,
		relatedEntities,
		relatedResources,
	};
}

//

interface GetDariahProjectSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getDariahProjectSlugs(
	db: Database | Transaction,
	params: GetDariahProjectSlugsParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.dariahProjects.findMany({
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
			.from(schema.dariahProjects)
			.innerJoin(schema.entityVersions, eq(schema.dariahProjects.id, schema.entityVersions.id))
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

interface GetDariahProjectBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getDariahProjectBySlug(
	db: Database | Transaction,
	params: GetDariahProjectBySlugParams,
) {
	const { slug } = params;

	const item = await db.query.dariahProjects.findFirst({
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

	const [fields, relatedEntities, relatedResources] = await Promise.all([
		getContentBlocks(db, item.id),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
	]);

	const projectPartners = await getPublishedProjectPartners(db, item.entityVersion.entity.id);
	const rest = item;

	const participants = projectPartners
		.filter((r) => r.role.role === "participant")
		.map((r) => r.unit);

	const coordinators = projectPartners
		.filter((r) => r.role.role === "coordinator")
		.map((r) => r.unit);

	return {
		...mapItem(rest, imageWidth.featured),
		...fields,
		participants,
		coordinators,
		relatedEntities,
		relatedResources,
	};
}
