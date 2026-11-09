import { revalidatePath } from "next/cache";

import { ingestSshocServices } from "@/lib/admin-tasks/ingest-sshoc-services";
import {
	type BackgroundJobKind,
	type RunBackgroundJobOutcome,
	runBackgroundJob,
} from "@/lib/admin-tasks/run-background-job";
import { syncResourcesSearchIndex } from "@/lib/admin-tasks/sync-resources-search-index";
import { syncWebsiteSearchIndex } from "@/lib/admin-tasks/sync-website-search-index";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { db } from "@/lib/db";

/**
 * Start the admin task of the given kind as a background job. Shared by the admin dashboard actions
 * and the scheduled-trigger api route, so both record the same audit event and revalidate the same
 * paths. `triggeredByUserId` is `null` for scheduled runs.
 */
export async function startAdminTask(
	kind: BackgroundJobKind,
	triggeredByUserId: string | null,
): Promise<RunBackgroundJobOutcome> {
	switch (kind) {
		case "ingest_sshoc_services": {
			return runBackgroundJob({
				kind,
				triggeredByUserId,
				run: async () => {
					const result = await ingestSshocServices();

					await recordAuditEvent(db, {
						actorUserId: triggeredByUserId,
						action: "ingest",
						subjectType: "sshoc_services",
						subjectId: "all",
						summary: {
							createdCount: result.createdCount,
							fetchedCount: result.fetchedCount,
							markedNeedsReviewCount: result.markedNeedsReviewCount,
							updatedCount: result.updatedCount,
						},
					});

					revalidatePath("/[locale]/dashboard/administrator", "layout");
					revalidatePath("/[locale]/dashboard/administrator/sshoc-services", "layout");

					return result;
				},
			});
		}

		case "sync_resources_search_index": {
			return runBackgroundJob({
				kind,
				triggeredByUserId,
				run: async () => {
					const result = await syncResourcesSearchIndex();

					await recordAuditEvent(db, {
						actorUserId: triggeredByUserId,
						action: "sync",
						subjectType: "resources_search_index",
						subjectId: "all",
						summary: {
							count: result.count,
							failedCount: result.failedCount,
							websiteCount: result.websiteCount,
						},
					});

					revalidatePath("/[locale]/dashboard/administrator", "layout");

					return result;
				},
			});
		}

		case "sync_website_search_index": {
			return runBackgroundJob({
				kind,
				triggeredByUserId,
				run: async () => {
					const result = await syncWebsiteSearchIndex();

					await recordAuditEvent(db, {
						actorUserId: triggeredByUserId,
						action: "sync",
						subjectType: "website_search_index",
						subjectId: "all",
						summary: { count: result.count, failedCount: result.failedCount },
					});

					revalidatePath("/[locale]/dashboard/administrator", "layout");

					return result;
				},
			});
		}
	}
}
