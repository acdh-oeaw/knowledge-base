import { createUrl } from "@acdh-oeaw/lib";
import {
	type SearchItem,
	type SshocClient,
	isCoreService,
	isSoftware,
} from "@dariah-eric/client-sshoc";
import type { Database } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, inArray, isNotNull } from "@dariah-eric/database/sql";

interface SshocServiceSnapshot {
	accessibleAt: Array<string>;
	actorIds: Array<number>;
	itemId: number;
	lastInfoUpdate: string;
	marketplaceUrl: string;
	status: string;
}

export interface IngestSshocServicesParams {
	db: Database;
	sshoc: SshocClient;
	sshocMarketplaceBaseUrl: string;
}

export interface IngestSshocServicesResult {
	createdCount: number;
	fetchedCount: number;
	markedNeedsReviewCount: number;
	relationCount: number;
	updatedCount: number;
}

function createSshocSnapshot(
	item: SearchItem,
	sshocMarketplaceBaseUrl: string,
): SshocServiceSnapshot {
	return {
		accessibleAt: item.accessibleAt ?? [],
		actorIds: item.contributors.map((contributor) => contributor.actor.id),
		itemId: item.id,
		lastInfoUpdate: item.lastInfoUpdate,
		marketplaceUrl: String(
			createUrl({
				baseUrl: sshocMarketplaceBaseUrl,
				pathname: `/${item.category}/${item.persistentId}`,
			}),
		),
		status: item.status,
	};
}

function mergeServiceMetadata(
	metadata: schema.Service["metadata"],
	item: SearchItem,
	sshocMarketplaceBaseUrl: string,
): Record<string, unknown> {
	return {
		...(typeof metadata === "object" && metadata != null ? metadata : {}),
		sshoc: createSshocSnapshot(item, sshocMarketplaceBaseUrl),
	};
}

export async function ingestSshocServices(
	params: IngestSshocServicesParams,
): Promise<IngestSshocServicesResult> {
	const { db, sshoc, sshocMarketplaceBaseUrl } = params;

	const [
		items,
		serviceTypes,
		serviceStatuses,
		serviceRoles,
		organisationalUnits,
		existingServices,
	] = await Promise.all([
		sshoc.items
			.searchAll({
				"f.keyword": ["DARIAH Resource"],
				categories: ["tool-or-service"],
				order: ["label"],
			})
			.then((result) => result.unwrap()),
		db
			.select({ id: schema.serviceTypes.id, type: schema.serviceTypes.type })
			.from(schema.serviceTypes)
			.where(inArray(schema.serviceTypes.type, ["community", "core"])),
		db
			.select({ id: schema.serviceStatuses.id, status: schema.serviceStatuses.status })
			.from(schema.serviceStatuses)
			.where(inArray(schema.serviceStatuses.status, ["live", "needs_review"])),
		db
			.select({
				id: schema.organisationalUnitServiceRoles.id,
				role: schema.organisationalUnitServiceRoles.role,
			})
			.from(schema.organisationalUnitServiceRoles)
			.where(
				inArray(schema.organisationalUnitServiceRoles.role, ["service_owner", "service_provider"]),
			),
		db
			// service↔unit relations are document-level; key units by their document id (published).
			.select({
				id: schema.entityVersions.entityId,
				sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
			})
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(
				and(
					isNotNull(schema.organisationalUnits.sshocMarketplaceActorId),
					eq(schema.entityStatus.type, "published"),
				),
			),
		db
			.select({
				id: schema.services.id,
				metadata: schema.services.metadata,
				sshocMarketplaceId: schema.services.sshocMarketplaceId,
				status: schema.serviceStatuses.status,
			})
			.from(schema.services)
			.innerJoin(schema.serviceStatuses, eq(schema.services.statusId, schema.serviceStatuses.id))
			.where(isNotNull(schema.services.sshocMarketplaceId)),
	]);

	const serviceTypeIds = new Map(
		serviceTypes.map((serviceType) => [serviceType.type, serviceType.id] as const),
	);
	const serviceStatusIds = new Map(
		serviceStatuses.map((serviceStatus) => [serviceStatus.status, serviceStatus.id] as const),
	);
	const serviceRoleIds = new Map(
		serviceRoles.map((serviceRole) => [serviceRole.role, serviceRole.id] as const),
	);
	const organisationalUnitIdsByActorId = new Map(
		organisationalUnits.flatMap((organisationalUnit) =>
			organisationalUnit.sshocMarketplaceActorId == null
				? []
				: ([[organisationalUnit.sshocMarketplaceActorId, organisationalUnit.id]] as const),
		),
	);
	const existingServicesByMarketplaceId = new Map(
		existingServices.flatMap((service) =>
			service.sshocMarketplaceId == null ? [] : ([[service.sshocMarketplaceId, service]] as const),
		),
	);

	const liveStatusId = serviceStatusIds.get("live");
	const needsReviewStatusId = serviceStatusIds.get("needs_review");
	const ownerRoleId = serviceRoleIds.get("service_owner");
	const providerRoleId = serviceRoleIds.get("service_provider");

	if (liveStatusId == null || needsReviewStatusId == null) {
		throw new Error("Missing service status lookup data.");
	}

	if (ownerRoleId == null || providerRoleId == null) {
		throw new Error("Missing organisational unit service role lookup data.");
	}

	const sshocServices = items.filter((item) => !isSoftware(item));

	let createdCount = 0;
	let updatedCount = 0;
	let relationCount = 0;

	const seenMarketplaceIds = new Set<string>();

	for (const item of sshocServices) {
		const sshocMarketplaceId = item.persistentId;
		const typeId = serviceTypeIds.get(isCoreService(item) ? "core" : "community");

		if (typeId == null) {
			throw new Error("Missing service type lookup data.");
		}

		const ownerUnitIds = new Set<string>();
		const providerUnitIds = new Set<string>();

		for (const contributor of item.contributors) {
			const organisationalUnitId = organisationalUnitIdsByActorId.get(contributor.actor.id);

			if (organisationalUnitId == null) {
				continue;
			}

			if (contributor.role.code === "reviewer") {
				ownerUnitIds.add(organisationalUnitId);
			}

			if (contributor.role.code === "provider") {
				providerUnitIds.add(organisationalUnitId);
			}
		}

		const existingService = existingServicesByMarketplaceId.get(sshocMarketplaceId);
		const metadata = mergeServiceMetadata(existingService?.metadata, item, sshocMarketplaceBaseUrl);

		await db.transaction(async (tx) => {
			const serviceId =
				existingService == null
					? await tx
							.insert(schema.services)
							.values({
								metadata,
								name: item.label.trim(),
								sshocMarketplaceId,
								statusId: liveStatusId,
								typeId,
							})
							.returning({ id: schema.services.id })
							.then((rows) => {
								const row = rows[0];

								if (row == null) {
									throw new Error("Failed to create SSHOC service.");
								}

								createdCount += 1;

								return row.id;
							})
					: await tx
							.update(schema.services)
							.set({
								metadata,
								name: item.label.trim(),
								sshocMarketplaceId,
								typeId,
							})
							.where(eq(schema.services.id, existingService.id))
							.returning({ id: schema.services.id })
							.then((rows) => {
								const row = rows[0];

								if (row == null) {
									throw new Error("Failed to update SSHOC service.");
								}

								updatedCount += 1;

								return row.id;
							});

			const relations = [
				...[...ownerUnitIds].map((organisationalUnitDocumentId) => {
					return {
						serviceId,
						organisationalUnitDocumentId,
						roleId: ownerRoleId,
					};
				}),
				...[...providerUnitIds].map((organisationalUnitDocumentId) => {
					return {
						serviceId,
						organisationalUnitDocumentId,
						roleId: providerRoleId,
					};
				}),
			];

			if (relations.length > 0) {
				const existingRelations = await tx
					.select({
						organisationalUnitDocumentId:
							schema.servicesToOrganisationalUnits.organisationalUnitDocumentId,
						roleId: schema.servicesToOrganisationalUnits.roleId,
					})
					.from(schema.servicesToOrganisationalUnits)
					.where(eq(schema.servicesToOrganisationalUnits.serviceId, serviceId));

				const existingRelationKeys = new Set(
					existingRelations.map((relation) =>
						[relation.organisationalUnitDocumentId, relation.roleId].join(":"),
					),
				);

				/**
				 * Preserve locally curated relations for now. The correct fix is to store relation
				 * provenance, then replace only the SSHOC-managed subset here. That also depends on a
				 * product decision: are SSHOC service relations exclusively managed upstream, or can admins
				 * add local owner/provider links that should survive re-ingest?
				 */
				const missingRelations = relations.filter(
					(relation) =>
						!existingRelationKeys.has(
							[relation.organisationalUnitDocumentId, relation.roleId].join(":"),
						),
				);

				if (missingRelations.length > 0) {
					await tx.insert(schema.servicesToOrganisationalUnits).values(missingRelations);
					relationCount += missingRelations.length;
				}
			}
		});

		seenMarketplaceIds.add(sshocMarketplaceId);
	}

	const servicesToMarkNeedsReview = existingServices.filter(
		(service) =>
			service.sshocMarketplaceId != null &&
			!seenMarketplaceIds.has(service.sshocMarketplaceId) &&
			service.status === "live",
	);

	if (servicesToMarkNeedsReview.length > 0) {
		await db
			.update(schema.services)
			.set({ statusId: needsReviewStatusId })
			.where(
				inArray(
					schema.services.id,
					servicesToMarkNeedsReview.map((service) => service.id),
				),
			);
	}

	return {
		createdCount,
		fetchedCount: sshocServices.length,
		markedNeedsReviewCount: servicesToMarkNeedsReview.length,
		relationCount,
		updatedCount,
	};
}
