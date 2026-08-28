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

/** Identifies a single service in the ingest report, enough to look it up in either system. */
export interface IngestedSshocService {
	id: string;
	name: string;
	sshocMarketplaceId: string;
}

/**
 * A service that is still published upstream but whose local status is not `live`. Ingest never
 * promotes a status back to `live` (see the `serviceStatuses` docs), so these stay put until an
 * admin acts on them — without this report they are invisible.
 */
export interface ReappearedSshocService extends IngestedSshocService {
	status: string;
}

/**
 * An upstream contributor whose actor id maps to no published organisational unit, so the
 * owner/provider relation it implies could not be created.
 */
export interface UnmappedSshocActor {
	id: number;
	name: string;
	serviceCount: number;
}

export interface IngestSshocServicesResult {
	createdCount: number;
	fetchedCount: number;
	markedNeedsReviewCount: number;
	relationCount: number;
	/** Owner/provider relations dropped because upstream no longer lists them. */
	removedRelationCount: number;
	updatedCount: number;
	/** Services inserted on this run. */
	created: Array<IngestedSshocService>;
	/** Services flipped from `live` to `needs_review` because they dropped out of the fetch. */
	markedNeedsReview: Array<IngestedSshocService>;
	/** Services returned upstream that are stuck at a non-`live` local status. */
	reappeared: Array<ReappearedSshocService>;
	/** Contributors that could not be resolved to an organisational unit. */
	unmappedActors: Array<UnmappedSshocActor>;
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
				name: schema.services.name,
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
	let removedRelationCount = 0;

	const seenMarketplaceIds = new Set<string>();
	const created: Array<IngestedSshocService> = [];
	const reappeared: Array<ReappearedSshocService> = [];
	/**
	 * Keyed by actor id; the set holds marketplace ids so an actor listed under both relevant roles
	 * on one service is still counted once.
	 */
	const unmappedActors = new Map<number, { id: number; name: string; services: Set<string> }>();

	for (const item of sshocServices) {
		const sshocMarketplaceId = item.persistentId;
		const typeId = serviceTypeIds.get(isCoreService(item) ? "core" : "community");

		if (typeId == null) {
			throw new Error("Missing service type lookup data.");
		}

		const ownerUnitIds = new Set<string>();
		const providerUnitIds = new Set<string>();

		for (const contributor of item.contributors) {
			const isRelevantRole =
				contributor.role.code === "reviewer" || contributor.role.code === "provider";
			const organisationalUnitId = organisationalUnitIdsByActorId.get(contributor.actor.id);

			if (organisationalUnitId == null) {
				/**
				 * Only owner/provider contributors imply a relation, so an unmapped actor in any other role
				 * is expected and not worth reporting.
				 */
				if (isRelevantRole) {
					const unmappedActor = unmappedActors.get(contributor.actor.id);

					if (unmappedActor == null) {
						unmappedActors.set(contributor.actor.id, {
							id: contributor.actor.id,
							name: contributor.actor.name,
							services: new Set([sshocMarketplaceId]),
						});
					} else {
						unmappedActor.services.add(sshocMarketplaceId);
					}
				}

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
								created.push({
									id: row.id,
									name: item.label.trim(),
									sshocMarketplaceId,
								});

								/**
								 * Register the freshly inserted row so a marketplace id that appears more than once
								 * in a single fetch takes the update branch on its next occurrence instead of a
								 * second insert that would violate the `sshoc_marketplace_id` unique constraint.
								 * Upstream deep-paging is not snapshot-isolated, so an edit landing mid-fetch can
								 * shift an item across a page boundary and return it twice.
								 */
								existingServicesByMarketplaceId.set(sshocMarketplaceId, {
									id: row.id,
									metadata,
									name: item.label.trim(),
									sshocMarketplaceId,
									status: "live",
								});

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

								if (existingService.status !== "live") {
									reappeared.push({
										id: row.id,
										name: item.label.trim(),
										sshocMarketplaceId,
										status: existingService.status,
									});
								}

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

			/**
			 * Upstream is the source of truth for owner/provider relations on SSHOC services — they are
			 * not editable locally, since the admin service forms only cover services without a
			 * marketplace id. So reconcile rather than merge: relations the marketplace no longer lists
			 * are removed, including ones an earlier import created. Runs unconditionally, because a
			 * service that lost all its contributors upstream must end up with no relations here.
			 */
			const existingRelations = await tx
				.select({
					id: schema.servicesToOrganisationalUnits.id,
					organisationalUnitDocumentId:
						schema.servicesToOrganisationalUnits.organisationalUnitDocumentId,
					roleId: schema.servicesToOrganisationalUnits.roleId,
				})
				.from(schema.servicesToOrganisationalUnits)
				.where(eq(schema.servicesToOrganisationalUnits.serviceId, serviceId));

			const toKey = (relation: { organisationalUnitDocumentId: string; roleId: string }) =>
				[relation.organisationalUnitDocumentId, relation.roleId].join(":");

			const existingRelationKeys = new Set(existingRelations.map((relation) => toKey(relation)));
			const expectedRelationKeys = new Set(relations.map((relation) => toKey(relation)));

			const staleRelationIds = existingRelations
				.filter((relation) => !expectedRelationKeys.has(toKey(relation)))
				.map((relation) => relation.id);

			if (staleRelationIds.length > 0) {
				await tx
					.delete(schema.servicesToOrganisationalUnits)
					.where(inArray(schema.servicesToOrganisationalUnits.id, staleRelationIds));
				removedRelationCount += staleRelationIds.length;
			}

			const missingRelations = relations.filter(
				(relation) => !existingRelationKeys.has(toKey(relation)),
			);

			if (missingRelations.length > 0) {
				await tx.insert(schema.servicesToOrganisationalUnits).values(missingRelations);
				relationCount += missingRelations.length;
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

	const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

	return {
		createdCount,
		fetchedCount: sshocServices.length,
		markedNeedsReviewCount: servicesToMarkNeedsReview.length,
		relationCount,
		removedRelationCount,
		updatedCount,
		created: created.toSorted(byName),
		markedNeedsReview: servicesToMarkNeedsReview
			.flatMap((service) =>
				service.sshocMarketplaceId == null
					? []
					: [
							{
								id: service.id,
								name: service.name,
								sshocMarketplaceId: service.sshocMarketplaceId,
							},
						],
			)
			.toSorted(byName),
		reappeared: reappeared.toSorted(byName),
		unmappedActors: [...unmappedActors.values()]
			.map((actor) => {
				return { id: actor.id, name: actor.name, serviceCount: actor.services.size };
			})
			.toSorted(byName),
	};
}
