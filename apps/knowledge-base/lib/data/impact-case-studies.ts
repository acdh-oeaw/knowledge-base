/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { imageAssetWidth } from "@/config/assets.config";
import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { and, count, desc, eq, sql } from "@/lib/db/sql";
import { images } from "@/lib/images";

export type ImpactCaseStudiesSort = "publicationDate" | "title";

interface GetImpactCaseStudiesParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	q?: string;
	sort?: ImpactCaseStudiesSort;
	dir?: "asc" | "desc";
}

export async function getImpactCaseStudies(params: GetImpactCaseStudiesParams) {
	const { limit = 10, offset = 0, q, sort = "publicationDate", dir = "desc" } = params;
	const query = q?.trim();
	const where =
		query != null && query !== ""
			? matchesAllTerms(query, schema.impactCaseStudies.title)
			: undefined;
	const orderBy =
		sort === "title"
			? dir === "asc"
				? schema.impactCaseStudies.title
				: desc(schema.impactCaseStudies.title)
			: dir === "asc"
				? schema.impactCaseStudies.publicationDate
				: desc(schema.impactCaseStudies.publicationDate);

	const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.impactCaseStudies.id,
				documentId: schema.entityVersions.entityId,
				slug: schema.slugs.value,
				summary: schema.impactCaseStudies.summary,
				title: schema.impactCaseStudies.title,
				publicationDate: schema.impactCaseStudies.publicationDate,
				isPublished: sql<boolean>`${schema.documentLifecycle.publishedId} IS NOT NULL`,
				hasDraft: schema.documentLifecycle.hasDraftChanges,
				status: schema.entityStatus.type,
				updatedAt: schema.entityVersions.updatedAt,
			})
			.from(schema.impactCaseStudies)
			.innerJoin(schema.entityVersions, eq(schema.impactCaseStudies.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(sql`${schema.entityVersions.id} = ${pickedVersion}`, where))
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.impactCaseStudies)
			.innerJoin(schema.entityVersions, eq(schema.impactCaseStudies.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(sql`${schema.entityVersions.id} = ${pickedVersion}`, where)),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => {
		return {
			id: item.id,
			documentId: item.documentId,
			entity: { slug: item.slug },
			hasDraft: item.hasDraft,
			summary: item.summary,
			title: item.title,
			isPublished: item.isPublished,
			publicationDate: item.publicationDate,
			status: item.status,
			updatedAt: item.updatedAt,
		};
	});

	return { data, limit, offset, total };
}

interface GetImpactCaseStudyByIdParams {
	id: schema.ImpactCaseStudy["id"];
}

export async function getImpactCaseStudyById(params: GetImpactCaseStudyByIdParams) {
	const { id } = params;

	const item = await db.query.impactCaseStudies.findFirst({
		where: {
			id,
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
			image: {
				columns: {
					key: true,
				},
			},
		},
	});

	if (item == null) {
		return null;
	}

	const image = images.generateSignedImageUrl({
		key: item.image.key,
		options: { width: imageAssetWidth.featured },
	});

	const { entityVersion, ...rest } = item;
	const data = { ...rest, entity: { slug: entityVersion.slug?.value ?? "" }, image };

	return data;
}

export type ImpactCaseStudiesWithEntities = Awaited<ReturnType<typeof getImpactCaseStudies>>;
export type ImpactCaseStudyWithEntities = Awaited<ReturnType<typeof getImpactCaseStudyById>>;
