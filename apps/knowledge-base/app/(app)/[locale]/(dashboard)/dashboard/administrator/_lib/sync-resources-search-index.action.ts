"use server";

import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { startAdminTask } from "@/lib/admin-tasks/start-admin-task";
import { assertAdmin } from "@/lib/auth/session";
import { createServerAction } from "@/lib/server/create-server-action";

export const syncResourcesSearchIndexAction = createServerAction(
	async function syncResourcesSearchIndexAction() {
		const t = await getExtracted();

		const auditSession = await assertAdmin();

		const outcome = await startAdminTask("sync_resources_search_index", auditSession.user.id);

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
