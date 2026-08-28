import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { count, desc, eq, inArray, sql } from "@/lib/db/sql";

export type UsersSort = "name" | "email" | "role" | "canManageAdmins" | "isEmailVerified";

interface GetUsersParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: UsersSort;
	dir?: "asc" | "desc";
}

/**
 * The person or country an account is linked to, resolved for display. Shaped to feed
 * `getEntityDetailHref` and `getEntityTypeLabel` directly, so a link that is not a country (the
 * pickers only offer countries, but the column is a generic organisational-unit reference) still
 * renders with its own label and detail-page href.
 */
export interface UserActor {
	entityType: "organisational_units" | "persons";
	unitType: string | null;
	slug: string;
	name: string;
}

export interface UsersResult {
	data: Array<
		Pick<schema.User, "canManageAdmins" | "email" | "id" | "isEmailVerified" | "name" | "role"> & {
			actor: UserActor | null;
		}
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

/**
 * Resolve the actor document ids of a page of users to displayable names, keyed by document id.
 * Like {@link getUserForAdmin}, the name comes from the actor's latest editable version -- published
 * when there is one, draft otherwise -- so a not-yet-published actor still shows its name.
 */
async function getUserActors(
	users: ReadonlyArray<Pick<schema.User, "organisationalUnitDocumentId" | "personDocumentId">>,
): Promise<Map<string, UserActor>> {
	const personDocumentIds = Array.from(
		new Set(users.map((user) => user.personDocumentId).filter((id) => id != null)),
	);
	const organisationalUnitDocumentIds = Array.from(
		new Set(users.map((user) => user.organisationalUnitDocumentId).filter((id) => id != null)),
	);

	const [persons, organisationalUnits] = await Promise.all([
		personDocumentIds.length > 0
			? db
					.select({
						documentId: schema.documentLifecycle.documentId,
						name: schema.persons.name,
						slug: schema.slugs.value,
					})
					.from(schema.persons)
					.innerJoin(
						schema.documentLifecycle,
						sql`${schema.persons.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
					)
					.innerJoin(schema.entities, eq(schema.entities.id, schema.documentLifecycle.documentId))
					.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.persons.id))
					.where(inArray(schema.documentLifecycle.documentId, personDocumentIds))
			: [],
		organisationalUnitDocumentIds.length > 0
			? db
					.select({
						documentId: schema.documentLifecycle.documentId,
						name: schema.organisationalUnits.name,
						slug: schema.slugs.value,
						unitType: schema.organisationalUnitTypes.type,
					})
					.from(schema.organisationalUnits)
					.innerJoin(
						schema.documentLifecycle,
						sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
					)
					.innerJoin(schema.entities, eq(schema.entities.id, schema.documentLifecycle.documentId))
					.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
					.innerJoin(
						schema.organisationalUnitTypes,
						eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
					)
					.where(inArray(schema.documentLifecycle.documentId, organisationalUnitDocumentIds))
			: [],
	]);

	const actors = new Map<string, UserActor>();

	for (const person of persons) {
		actors.set(person.documentId, {
			entityType: "persons",
			unitType: null,
			slug: person.slug,
			name: person.name,
		});
	}

	for (const organisationalUnit of organisationalUnits) {
		actors.set(organisationalUnit.documentId, {
			entityType: "organisational_units",
			unitType: organisationalUnit.unitType,
			slug: organisationalUnit.slug,
			name: organisationalUnit.name,
		});
	}

	return actors;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

async function getUsers(params: Readonly<GetUsersParams>): Promise<UsersResult> {
	const { limit, offset, q, sort = "name", dir = "asc" } = params;
	const query = q?.trim();
	const where = matchesAllTerms(query, schema.users.name, schema.users.email);

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
				organisationalUnitDocumentId: schema.users.organisationalUnitDocumentId,
				personDocumentId: schema.users.personDocumentId,
				role: schema.users.role,
			})
			.from(schema.users)
			.where(where)
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(schema.users).where(where),
	]);

	const actors = await getUserActors(items);

	return {
		data: items.map((item) => {
			const { organisationalUnitDocumentId, personDocumentId, ...user } = item;
			const actorDocumentId = personDocumentId ?? organisationalUnitDocumentId;

			return {
				...user,
				actor: actorDocumentId != null ? (actors.get(actorDocumentId) ?? null) : null,
			};
		}),
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
