/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { forbidden } from "next/navigation";

import {
	getOrganisationalUnitOptions,
	getOrganisationalUnitOptionsByDocumentIds,
} from "@/lib/data/organisational-units";
import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { and, count, desc, eq, inArray, sql } from "@/lib/db/sql";
import {
	toOrganisationalUnitDocumentOption,
	toOrganisationalUnitDocumentOptionsPage,
} from "@/lib/organisational-unit-options";

export type ServicesSort = "name" | "type" | "status" | "sshocMarketplaceId";
type ServiceTypes = (typeof schema.serviceTypesEnum)[number];

const InternalServiceTypes: Array<ServiceTypes> = ["internal"];
const SSHOCServiceTypes: Array<ServiceTypes> = ["community", "core"];

interface GetServicesParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: ServicesSort;
	type: "internal" | "sshoc";
	dir?: "asc" | "desc";
}

export interface ServicesResult {
	data: Array<
		Pick<schema.Service, "id" | "name" | "sshocMarketplaceId"> & {
			status: Pick<schema.ServiceStatus, "status">;
			type: Pick<schema.ServiceType, "type">;
		}
	>;
	limit: number;
	offset: number;
	total: number;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

export async function getServices(params: Readonly<GetServicesParams>): Promise<ServicesResult> {
	const { limit, offset, q, sort = "name", type, dir = "asc" } = params;
	const query = q?.trim();
	const serviceTypes: Array<ServiceTypes> =
		type === "internal" ? InternalServiceTypes : SSHOCServiceTypes;
	const where = and(
		query != null && query !== "" ? unaccentIlike(schema.services.name, `%${query}%`) : undefined,
		inArray(schema.serviceTypes.type, serviceTypes),
	);
	const orderBy =
		sort === "type"
			? dir === "asc"
				? schema.serviceTypes.type
				: desc(schema.serviceTypes.type)
			: sort === "status"
				? dir === "asc"
					? schema.serviceStatuses.status
					: desc(schema.serviceStatuses.status)
				: sort === "sshocMarketplaceId"
					? dir === "asc"
						? sql`${schema.services.sshocMarketplaceId} ASC NULLS LAST`
						: sql`${schema.services.sshocMarketplaceId} DESC NULLS LAST`
					: dir === "asc"
						? schema.services.name
						: desc(schema.services.name);

	const [data, aggregate] = await Promise.all([
		db
			.select({
				id: schema.services.id,
				name: schema.services.name,
				sshocMarketplaceId: schema.services.sshocMarketplaceId,
				status: schema.serviceStatuses.status,
				type: schema.serviceTypes.type,
			})
			.from(schema.services)
			.innerJoin(schema.serviceTypes, eq(schema.services.typeId, schema.serviceTypes.id))
			.innerJoin(schema.serviceStatuses, eq(schema.services.statusId, schema.serviceStatuses.id))
			.where(where)
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.services)
			.innerJoin(schema.serviceTypes, eq(schema.services.typeId, schema.serviceTypes.id))
			.innerJoin(schema.serviceStatuses, eq(schema.services.statusId, schema.serviceStatuses.id))
			.where(where),
	]);

	return {
		data: data.map((item) => {
			return {
				id: item.id,
				name: item.name,
				sshocMarketplaceId: item.sshocMarketplaceId,
				status: { status: item.status },
				type: { type: item.type },
			};
		}),
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getServicesForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetServicesParams>,
): Promise<ServicesResult> {
	assertAdminUser(currentUser);

	return getServices(params);
}

export async function getServiceCreateDataForAdmin(currentUser: Pick<User, "role">) {
	assertAdminUser(currentUser);

	const [serviceTypes, serviceStatuses, initialOrganisationalUnits] = await Promise.all([
		db.query.serviceTypes.findMany({ orderBy: { type: "asc" }, columns: { id: true, type: true } }),
		db.query.serviceStatuses.findMany({
			orderBy: { status: "asc" },
			columns: { id: true, status: true },
		}),
		getOrganisationalUnitOptions().then(toOrganisationalUnitDocumentOptionsPage),
	]);

	return { initialOrganisationalUnits, serviceStatuses, serviceTypes };
}

export async function getServiceForAdmin(currentUser: Pick<User, "role">, id: string) {
	assertAdminUser(currentUser);

	const [service, serviceTypes, serviceStatuses, initialOrganisationalUnits, serviceRoles] =
		await Promise.all([
			db.query.services.findFirst({
				where: { id },
				columns: {
					id: true,
					name: true,
					sshocMarketplaceId: true,
					typeId: true,
					statusId: true,
					comment: true,
					dariahBranding: true,
					monitoring: true,
					privateSupplier: true,
				},
				with: {
					status: {
						columns: {
							status: true,
						},
					},
					type: {
						columns: {
							type: true,
						},
					},
				},
			}),
			db.query.serviceTypes.findMany({
				orderBy: { type: "asc" },
				columns: { id: true, type: true },
			}),
			db.query.serviceStatuses.findMany({
				orderBy: { status: "asc" },
				columns: { id: true, status: true },
			}),
			getOrganisationalUnitOptions().then(toOrganisationalUnitDocumentOptionsPage),
			db.query.organisationalUnitServiceRoles.findMany({ columns: { id: true, role: true } }),
		]);

	if (service == null) {
		return null;
	}

	const unitRoleRows = await db
		.select({
			organisationalUnitDocumentId:
				schema.servicesToOrganisationalUnits.organisationalUnitDocumentId,
			roleId: schema.servicesToOrganisationalUnits.roleId,
		})
		.from(schema.servicesToOrganisationalUnits)
		.where(eq(schema.servicesToOrganisationalUnits.serviceId, id));

	const ownerRoleId = serviceRoles.find((r) => r.role === "service_owner")?.id;
	const providerRoleId = serviceRoles.find((r) => r.role === "service_provider")?.id;

	const ownerUnitDocumentIds = unitRoleRows
		.filter((r) => r.roleId === ownerRoleId)
		.map((r) => r.organisationalUnitDocumentId);

	const providerUnitDocumentIds = unitRoleRows
		.filter((r) => r.roleId === providerRoleId)
		.map((r) => r.organisationalUnitDocumentId);

	const selectedOrganisationalUnits = (
		await getOrganisationalUnitOptionsByDocumentIds([
			...new Set([...ownerUnitDocumentIds, ...providerUnitDocumentIds]),
		])
	).map(toOrganisationalUnitDocumentOption);

	return {
		initialOrganisationalUnits,
		selectedOrganisationalUnits,
		service: { ...service, ownerUnitDocumentIds, providerUnitDocumentIds },
		serviceStatuses,
		serviceTypes,
	};
}
