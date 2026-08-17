"use server";

import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { runBackgroundJob } from "@/lib/admin-tasks/run-background-job";
import { syncResourcesSearchIndex } from "@/lib/admin-tasks/sync-resources-search-index";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createServerAction } from "@/lib/server/create-server-action";

export const syncResourcesSearchIndexAction = createServerAction(
	async function syncResourcesSearchIndexAction() {
		const t = await getExtracted();

		const auditSession = await assertAdmin();
		const actorUserId = auditSession.user.id;

		const outcome = await runBackgroundJob({
			kind: "sync_resources_search_index",
			triggeredByUserId: actorUserId,
			run: async () => {
				const result = await syncResourcesSearchIndex();

				await recordAuditEvent(db, {
					actorUserId,
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

		if (outcome.status === "already_running") {
			return createActionStateError({
				message: t("A re-sync of the resources search index is already running."),
			});
		}

		return createActionStateSuccess({
			message: t("Started re-syncing the resources search index in the background."),
		});
	},
);
