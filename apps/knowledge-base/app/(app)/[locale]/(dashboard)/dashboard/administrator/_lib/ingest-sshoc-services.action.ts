"use server";

import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { startAdminTask } from "@/lib/admin-tasks/start-admin-task";
import { assertAdmin } from "@/lib/auth/session";
import { createServerAction } from "@/lib/server/create-server-action";

export const ingestSshocServicesAction = createServerAction(
	async function ingestSshocServicesAction() {
		const t = await getExtracted();

		const auditSession = await assertAdmin();

		const outcome = await startAdminTask("ingest_sshoc_services", auditSession.user.id);

		if (outcome.status === "already_running") {
			return createActionStateError({
				message: t("An SSHOC services ingest is already running."),
			});
		}

		return createActionStateSuccess({
			message: t("Started ingesting SSHOC services in the background."),
		});
	},
);
