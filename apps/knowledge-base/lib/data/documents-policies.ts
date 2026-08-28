/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { imageGridOptions } from "@/config/assets.config";
import {
	selectedImageColumns,
	selectedImageWith,
	toSelectedImage,
} from "@/lib/data/selected-image";
import { db } from "@/lib/db";
import { count, eq } from "@/lib/db/sql";

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
						slug: {
							columns: {
								value: true,
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
			entity: { slug: entityVersion.slug?.value ?? "", updatedAt: entityVersion.updatedAt },
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
					slug: {
						columns: {
							value: true,
						},
					},
				},
			},
			document: {
				columns: selectedImageColumns,
				with: selectedImageWith,
			},
		},
	});

	if (item == null) {
		return null;
	}

	const { entityVersion, ...rest } = item;
	const data = {
		...rest,
		entity: { slug: entityVersion.slug?.value ?? "" },
		document: toSelectedImage(item.document, imageGridOptions),
	};

	return data;
}

export type DocumentsPoliciesWithEntities = Awaited<ReturnType<typeof getDocumentsPolicies>>;
export type DocumentOrPolicyWithEntities = Awaited<ReturnType<typeof getDocumentOrPolicyById>>;
