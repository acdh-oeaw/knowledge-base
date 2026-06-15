/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { imageGridOptions } from "@/config/assets.config";
import { db } from "@/lib/db";
import { count, eq } from "@/lib/db/sql";
import { images } from "@/lib/images";

interface GetDocumentsPoliciesParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getDocumentsPolicies(params: GetDocumentsPoliciesParams) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.documentsPolicies.findMany({
			with: {
				entityVersion: {
					columns: { id: true, updatedAt: true },
					with: {
						entity: {
							columns: {
								slug: true,
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
			.from(schema.documentsPolicies)
			.innerJoin(schema.entityVersions, eq(schema.documentsPolicies.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id)),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map(({ entityVersion, ...rest }) => {
		return {
			...rest,
			entity: { slug: entityVersion.entity.slug, updatedAt: entityVersion.updatedAt },
		};
	});

	return { data, limit, offset, total };
}

interface GetDocumentOrPolicyByIdParams {
	id: schema.DocumentOrPolicy["id"];
}

export async function getDocumentOrPolicyById(params: GetDocumentOrPolicyByIdParams) {
	const { id } = params;

	const item = await db.query.documentsPolicies.findFirst({
		where: {
			id,
		},
		with: {
			entityVersion: {
				columns: {},
				with: {
					entity: {
						columns: {
							slug: true,
						},
					},
				},
			},
			document: {
				columns: {
					key: true,
					label: true,
				},
			},
		},
	});

	if (item == null) {
		return null;
	}

	const document = images.generateSignedImageUrl({
		key: item.document.key,
		options: imageGridOptions,
	});

	const { entityVersion, ...rest } = item;
	const data = {
		...rest,
		entity: entityVersion.entity,
		document: { ...item.document, url: document.url },
	};

	return data;
}

export type DocumentsPoliciesWithEntities = Awaited<ReturnType<typeof getDocumentsPolicies>>;
export type DocumentOrPolicyWithEntities = Awaited<ReturnType<typeof getDocumentOrPolicyById>>;
