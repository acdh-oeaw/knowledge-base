/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import type { Database, Transaction } from "@/middlewares/db";
import { count } from "@/services/db/sql";

function mapItem<
	T extends {
		type: { type: string };
		duration: { start: Date; end?: Date | null } | null;
		organisationalUnits: Array<{ id: string; name: string; type: { type: string } }>;
	},
>(item: T) {
	return {
		...item,
		type: item.type.type,
		duration: item.duration
			? {
					start: item.duration.start.toISOString(),
					end: item.duration.end?.toISOString() ?? null,
				}
			: null,
		organisationalUnits: item.organisationalUnits.map((unit) => {
			return { ...unit, type: unit.type.type };
		}),
	};
}

//

interface GetSocialMediaListParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getSocialMediaList(
	db: Database | Transaction,
	params: GetSocialMediaListParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db.query.socialMedia.findMany({
			columns: {
				id: true,
				name: true,
				url: true,
				duration: true,
			},
			with: {
				type: {
					columns: {
						id: true,
						type: true,
					},
				},
				organisationalUnits: {
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
			orderBy: {
				name: "asc",
			},
			limit,
			offset,
		}),
		db.select({ total: count() }).from(schema.socialMedia),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map((item) => mapItem(item));

	return { data, limit, offset, total };
}

interface GetSocialMediaByIdParams {
	id: schema.SocialMedia["id"];
}

export async function getSocialMediaById(
	db: Database | Transaction,
	params: GetSocialMediaByIdParams,
) {
	const { id } = params;

	const item = await db.query.socialMedia.findFirst({
		where: { id },
		columns: {
			id: true,
			name: true,
			url: true,
			duration: true,
		},
		with: {
			type: {
				columns: {
					id: true,
					type: true,
				},
			},
			organisationalUnits: {
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

	return mapItem(item);
}
