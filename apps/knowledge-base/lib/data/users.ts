import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { count, desc, eq, or, sql } from "@/lib/db/sql";

export type UsersSort = "name" | "email" | "role" | "canManageAdmins" | "isEmailVerified";

interface GetUsersParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: UsersSort;
	dir?: "asc" | "desc";
}

export interface UsersResult {
	data: Array<
		Pick<schema.User, "canManageAdmins" | "email" | "id" | "isEmailVerified" | "name" | "role">
	>;
	limit: number;
	offset: number;
	total: number;
}

export interface AdminUserDetails {
	id: string;
	name: string;
	email: string;
	role: schema.User["role"];
	canManageAdmins: boolean;
	personId: string | null;
	organisationalUnitId: string | null;
	person: { id: string; name: string } | null;
	organisationalUnit: { id: string; name: string } | null;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

async function getUsers(params: Readonly<GetUsersParams>): Promise<UsersResult> {
	const { limit, offset, q, sort = "name", dir = "asc" } = params;
	const query = q?.trim();
	const where =
		query != null && query !== ""
			? or(
					unaccentIlike(schema.users.name, `%${query}%`),
					unaccentIlike(schema.users.email, `%${query}%`),
				)
			: undefined;

	const orderBy =
		sort === "email"
			? dir === "asc"
				? schema.users.email
				: desc(schema.users.email)
			: sort === "role"
				? dir === "asc"
					? schema.users.role
					: desc(schema.users.role)
				: sort === "canManageAdmins"
					? dir === "asc"
						? schema.users.canManageAdmins
						: desc(schema.users.canManageAdmins)
					: sort === "isEmailVerified"
						? dir === "asc"
							? schema.users.isEmailVerified
							: desc(schema.users.isEmailVerified)
						: dir === "asc"
							? schema.users.name
							: desc(schema.users.name);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				canManageAdmins: schema.users.canManageAdmins,
				email: schema.users.email,
				id: schema.users.id,
				isEmailVerified: schema.users.isEmailVerified,
				name: schema.users.name,
				role: schema.users.role,
			})
			.from(schema.users)
			.where(where)
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(schema.users).where(where),
	]);

	return {
		data: items,
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getUsersForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetUsersParams>,
): Promise<UsersResult> {
	assertAdminUser(currentUser);

	return getUsers(params);
}

export async function getUserForAdmin(
	currentUser: Pick<User, "role">,
	id: string,
): Promise<AdminUserDetails | null> {
	assertAdminUser(currentUser);

	const user = await db.query.users.findFirst({
		where: { id },
		columns: {
			id: true,
			name: true,
			email: true,
			role: true,
			canManageAdmins: true,
			personDocumentId: true,
			organisationalUnitDocumentId: true,
		},
	});

	if (user == null) {
		return null;
	}

	// The actor is stored as a document id; resolve it to its latest editable version for the name,
	// and report the document id back (matching the document-id actor pickers).
	const [person, organisationalUnit] = await Promise.all([
		user.personDocumentId != null
			? db
					.select({ id: schema.documentLifecycle.documentId, name: schema.persons.name })
					.from(schema.persons)
					.innerJoin(
						schema.documentLifecycle,
						sql`${schema.persons.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
					)
					.where(eq(schema.documentLifecycle.documentId, user.personDocumentId))
					.then((rows) => rows[0] ?? null)
			: null,
		user.organisationalUnitDocumentId != null
			? db
					.select({
						id: schema.documentLifecycle.documentId,
						name: schema.organisationalUnits.name,
					})
					.from(schema.organisationalUnits)
					.innerJoin(
						schema.documentLifecycle,
						sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
					)
					.where(eq(schema.documentLifecycle.documentId, user.organisationalUnitDocumentId))
					.then((rows) => rows[0] ?? null)
			: null,
	]);

	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		canManageAdmins: user.canManageAdmins,
		personId: user.personDocumentId,
		organisationalUnitId: user.organisationalUnitDocumentId,
		person,
		organisationalUnit,
	};
}
