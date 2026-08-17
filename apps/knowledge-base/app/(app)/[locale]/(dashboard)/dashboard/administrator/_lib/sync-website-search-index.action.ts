"use server";

import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { runBackgroundJob } from "@/lib/admin-tasks/run-background-job";
import { syncWebsiteSearchIndex } from "@/lib/admin-tasks/sync-website-search-index";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createServerAction } from "@/lib/server/create-server-action";

export const syncWebsiteSearchIndexAction = createServerAction(
	async function syncWebsiteSearchIndexAction() {
		const t = await getExtracted();

		const auditSession = await assertAdmin();
		const actorUserId = auditSession.user.id;

		const outcome = await runBackgroundJob({
			kind: "sync_website_search_index",
			triggeredByUserId: actorUserId,
			run: async () => {
				const result = await syncWebsiteSearchIndex();

				await recordAuditEvent(db, {
					actorUserId,
					action: "sync",
					subjectType: "website_search_index",
					subjectId: "all",
					summary: { count: result.count, failedCount: result.failedCount },
				});

				revalidatePath("/[locale]/dashboard/administrator", "layout");

				return result;
			},
		});

		if (outcome.status === "already_running") {
			return createActionStateError({
				message: t("A re-sync of the website search index is already running."),
			});
		}

		return createActionStateSuccess({
			message: t("Started re-syncing the website search index in the background."),
		});
	},
);
