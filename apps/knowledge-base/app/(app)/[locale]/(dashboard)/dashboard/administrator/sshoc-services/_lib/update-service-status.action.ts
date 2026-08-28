"use server";

import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { UpdateServiceStatusActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/sshoc-services/_lib/update-service-status.schema";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

/**
 * Status is the only field of an ingested service that is owned by the knowledge base: the sshoc
 * ingest writes `statusId` on insert only, and otherwise touches it just to flip `live` to
 * `needs_review` when a service drops out of the marketplace response. Every other field is
 * overwritten on re-ingest, which is why this action is status-only rather than a reuse of the
 * internal-services update action.
 */
export const updateServiceStatusAction = createMutationAction({
	schema: UpdateServiceStatusActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "sshoc_services" },
	revalidate: "/[locale]/dashboard/administrator/sshoc-services",

	async preCheck({ input }) {
		const t = await getExtracted();

		const service = await db.query.services.findFirst({
			where: { id: input.id },
			columns: { sshocMarketplaceId: true },
		});

		if (service?.sshocMarketplaceId == null) {
			return createActionStateError({
				message: t("Only SSHOC marketplace services can be updated here."),
			});
		}

		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		await tx
			.update(schema.services)
			.set({ statusId: input.statusId })
			.where(eq(schema.services.id, input.id));

		return { subjectId: input.id, successMessage: t("Service status updated.") };
	},
});
