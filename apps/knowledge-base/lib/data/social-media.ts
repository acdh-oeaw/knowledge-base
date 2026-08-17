/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { count, desc, eq, inArray, or } from "@/lib/db/sql";

export interface SocialMediaOption {
	id: string;
	name: string;
	description: string;
}

export type SocialMediaSort = "name" | "type";

interface GetSocialMediaParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: SocialMediaSort;
	dir?: "asc" | "desc";
}

export interface SocialMediaResult {
	data: Array<
		Pick<schema.SocialMedia, "id" | "name" | "url"> & {
			type: Pick<schema.SocialMediaType, "type">;
		}
	>;
	limit: number;
	offset: number;
	total: number;
}

interface GetSocialMediaOptionsParams {
	limit?: number;
	offset?: number;
	q?: string;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

export async function getSocialMedia(
	params: Readonly<GetSocialMediaParams>,
): Promise<SocialMediaResult> {
	const { limit, offset, q, sort = "name", dir = "asc" } = params;
	const query = q?.trim();
	const where =
		query != null && query !== ""
			? or(
					unaccentIlike(schema.socialMedia.name, `%${query}%`),
					unaccentIlike(schema.socialMedia.url, `%${query}%`),
				)
			: undefined;
	const orderBy =
		sort === "type"
			? dir === "asc"
				? schema.socialMediaTypes.type
				: desc(schema.socialMediaTypes.type)
			: dir === "asc"
				? schema.socialMedia.name
				: desc(schema.socialMedia.name);

	const [rows, aggregate] = await Promise.all([
		db
			.select({
				id: schema.socialMedia.id,
				name: schema.socialMedia.name,
				type: schema.socialMediaTypes.type,
				url: schema.socialMedia.url,
			})
			.from(schema.socialMedia)
			.innerJoin(schema.socialMediaTypes, eq(schema.socialMedia.typeId, schema.socialMediaTypes.id))
			.where(where)
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(schema.socialMedia).where(where),
	]);

	return {
		data: rows.map((row) => {
			return {
				id: row.id,
				name: row.name,
				type: { type: row.type },
				url: row.url,
			};
		}),
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getSocialMediaForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetSocialMediaParams>,
): Promise<SocialMediaResult> {
	assertAdminUser(currentUser);

	return getSocialMedia(params);
}

export async function getSocialMediaByIdForAdmin(currentUser: Pick<User, "role">, id: string) {
	assertAdminUser(currentUser);

	return db.query.socialMedia.findFirst({
		where: { id },
		columns: { id: true, name: true, url: true, duration: true },
		with: { type: { columns: { type: true } } },
	});
}

export async function getSocialMediaOptions(
	params: GetSocialMediaOptionsParams = {},
): Promise<{ items: Array<SocialMediaOption>; total: number }> {
	const { limit = 20, offset = 0, q } = params;
	const query = q?.trim();
	const where =
		query != null && query !== ""
			? or(
					unaccentIlike(schema.socialMedia.name, `%${query}%`),
					unaccentIlike(schema.socialMedia.url, `%${query}%`),
				)
			: undefined;

	const [rows, aggregate] = await Promise.all([
		db
			.select({
				id: schema.socialMedia.id,
				name: schema.socialMedia.name,
				type: schema.socialMediaTypes.type,
				url: schema.socialMedia.url,
			})
			.from(schema.socialMedia)
			.innerJoin(schema.socialMediaTypes, eq(schema.socialMedia.typeId, schema.socialMediaTypes.id))
			.where(where)
			.orderBy(schema.socialMedia.name)
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(schema.socialMedia).where(where),
	]);

	return {
		items: rows.map((row) => {
			return {
				description: `${row.type} · ${row.url}`,
				id: row.id,
				name: row.name,
			};
		}),
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getSocialMediaOptionsByIds(ids: ReadonlyArray<string>) {
	if (ids.length === 0) {
		return [];
	}

	const rows = await db
		.select({
			id: schema.socialMedia.id,
			name: schema.socialMedia.name,
			type: schema.socialMediaTypes.type,
			url: schema.socialMedia.url,
		})
		.from(schema.socialMedia)
		.innerJoin(schema.socialMediaTypes, eq(schema.socialMedia.typeId, schema.socialMediaTypes.id))
		.where(inArray(schema.socialMedia.id, [...ids]));

	const itemById = new Map(
		rows.map(
			(row) =>
				[
					row.id,
					{
						description: `${row.type} · ${row.url}`,
						id: row.id,
						name: row.name,
						type: row.type,
						url: row.url,
					},
				] as const,
		),
	);

	return ids.flatMap((id) => {
		const item = itemById.get(id);
		return item != null ? [item] : [];
	});
}
