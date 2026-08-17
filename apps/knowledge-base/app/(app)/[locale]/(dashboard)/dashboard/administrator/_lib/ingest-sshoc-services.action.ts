"use server";

import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { ingestSshocServices } from "@/lib/admin-tasks/ingest-sshoc-services";
import { runBackgroundJob } from "@/lib/admin-tasks/run-background-job";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createServerAction } from "@/lib/server/create-server-action";

export const ingestSshocServicesAction = createServerAction(
	async function ingestSshocServicesAction() {
		const t = await getExtracted();

		const auditSession = await assertAdmin();
		const actorUserId = auditSession.user.id;

		const outcome = await runBackgroundJob({
			kind: "ingest_sshoc_services",
			triggeredByUserId: actorUserId,
			run: async () => {
				const result = await ingestSshocServices();

				await recordAuditEvent(db, {
					actorUserId,
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
