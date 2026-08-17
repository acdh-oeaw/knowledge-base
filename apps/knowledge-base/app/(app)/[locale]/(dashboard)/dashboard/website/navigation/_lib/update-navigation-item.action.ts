"use server";

import * as schema from "@dariah-eric/database/schema";

import { UpdateNavigationItemActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_lib/update-navigation-item.schema";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateNavigationItemAction = createMutationAction({
	schema: UpdateNavigationItemActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "navigation" },
	revalidate: "/[locale]/dashboard/website/navigation",

	async mutate(tx, input) {
		await tx
			.update(schema.navigationItems)
			.set({
				label: input.label,
				href: input.href ?? null,
				entityId: input.entityId ?? null,
				isExternal: input.isExternal ?? false,
			})
			.where(eq(schema.navigationItems.id, input.id));

		return { subjectId: input.id };
	},

	async postCommit() {
		await dispatchWebhook({ type: "navigation" });
	},
});
