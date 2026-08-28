import type * as schema from "@dariah-eric/database/schema";

/**
 * Typed views over the `background_jobs.result` jsonb column so the admin dashboard can render a
 * readable report instead of a raw JSON dump.
 *
 * Rows are persisted by whichever version of the task was deployed at the time, so every field here
 * is treated as potentially absent. In particular, rows written before the SSHOC ingest reported
 * per-service detail carry only the counts — `hasDetails` distinguishes "this run recorded no
 * affected services" from "this run predates detail reporting", which are very different claims to
 * put in front of an admin.
 */

export interface SshocServiceRef {
	id: string;
	name: string;
	sshocMarketplaceId: string;
	/** Only present for reappeared services: the local status they are stuck at. */
	status: string | null;
}

export interface UnmappedActorRef {
	id: number;
	name: string;
	serviceCount: number;
}

export interface IngestSshocServicesJobResult {
	kind: "ingest_sshoc_services";
	createdCount: number;
	fetchedCount: number;
	markedNeedsReviewCount: number;
	relationCount: number;
	removedRelationCount: number;
	updatedCount: number;
	created: Array<SshocServiceRef>;
	markedNeedsReview: Array<SshocServiceRef>;
	reappeared: Array<SshocServiceRef>;
	unmappedActors: Array<UnmappedActorRef>;
	hasDetails: boolean;
}

export interface StaleDocumentRef {
	collection: string;
	documentId: string;
}

export interface SyncSearchIndexJobResult {
	kind: "sync_resources_search_index" | "sync_website_search_index";
	count: number;
	/**
	 * Stale documents that could not be deleted. Not "documents that failed to index" — an ingest
	 * failure throws and fails the whole job.
	 */
	failedCount: number;
	failedDeletions: Array<StaleDocumentRef>;
	/** Only reported by the resources index sync. */
	websiteCount: number | null;
	hasDetails: boolean;
}

/** A result whose shape we could not recognise — rendered as raw JSON, as before. */
export interface UnknownJobResult {
	kind: "unknown";
	value: unknown;
}

export type BackgroundJobResult =
	| IngestSshocServicesJobResult
	| SyncSearchIndexJobResult
	| UnknownJobResult;

function asRecord(value: unknown): Record<string, unknown> | null {
	return value != null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function toCount(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toOptionalCount(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toText(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function toServiceRefs(value: unknown): Array<SshocServiceRef> {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((entry) => {
		const record = asRecord(entry);
		const id = toText(record?.id);
		const name = toText(record?.name);

		if (record == null || id == null || name == null) {
			return [];
		}

		return [
			{
				id,
				name,
				sshocMarketplaceId: toText(record.sshocMarketplaceId) ?? "",
				status: toText(record.status),
			},
		];
	});
}

function toStaleDocumentRefs(value: unknown): Array<StaleDocumentRef> {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((entry) => {
		const record = asRecord(entry);
		const documentId = toText(record?.documentId);

		if (record == null || documentId == null) {
			return [];
		}

		return [{ collection: toText(record.collection) ?? "", documentId }];
	});
}

function toUnmappedActors(value: unknown): Array<UnmappedActorRef> {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((entry) => {
		const record = asRecord(entry);
		const name = toText(record?.name);

		if (record == null || name == null || typeof record.id !== "number") {
			return [];
		}

		return [{ id: record.id, name, serviceCount: toCount(record.serviceCount) }];
	});
}

/**
 * Coerce a persisted `background_jobs.result` into a shape the dashboard can render, based on the
 * job kind that produced it.
 */
export function coerceBackgroundJobResult(
	kind: schema.BackgroundJobKind,
	value: unknown,
): BackgroundJobResult {
	const record = asRecord(value);

	if (record == null) {
		return { kind: "unknown", value };
	}

	switch (kind) {
		case "ingest_sshoc_services": {
			return {
				kind,
				createdCount: toCount(record.createdCount),
				fetchedCount: toCount(record.fetchedCount),
				markedNeedsReviewCount: toCount(record.markedNeedsReviewCount),
				relationCount: toCount(record.relationCount),
				removedRelationCount: toCount(record.removedRelationCount),
				updatedCount: toCount(record.updatedCount),
				created: toServiceRefs(record.created),
				markedNeedsReview: toServiceRefs(record.markedNeedsReview),
				reappeared: toServiceRefs(record.reappeared),
				unmappedActors: toUnmappedActors(record.unmappedActors),
				hasDetails: Array.isArray(record.markedNeedsReview),
			};
		}

		case "sync_resources_search_index":
		case "sync_website_search_index": {
			return {
				kind,
				count: toCount(record.count),
				failedCount: toCount(record.failedCount),
				failedDeletions: toStaleDocumentRefs(record.failedDeletions),
				websiteCount: toOptionalCount(record.websiteCount),
				hasDetails: Array.isArray(record.failedDeletions),
			};
		}
	}
}
