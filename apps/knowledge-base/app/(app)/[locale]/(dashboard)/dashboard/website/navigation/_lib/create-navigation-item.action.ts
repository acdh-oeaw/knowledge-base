"use server";

import * as schema from "@acdh-knowledge-base/database/schema";

import { CreateNavigationItemActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_lib/create-navigation-item.schema";
import { and, eq, isNull } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const createNavigationItemAction = createMutationAction({
	schema: CreateNavigationItemActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "navigation" },
	revalidate: "/[locale]/dashboard/website/navigation",

	async mutate(tx, input) {
		const siblings = await tx
			.select({ id: schema.navigationItems.id })
			.from(schema.navigationItems)
			.where(
				input.parentId != null
					? eq(schema.navigationItems.parentId, input.parentId)
					: and(
							eq(schema.navigationItems.menuId, input.menuId),
							isNull(schema.navigationItems.parentId),
						),
			);

		await tx.insert(schema.navigationItems).values({
			menuId: input.menuId,
			parentId: input.parentId ?? null,
			label: input.label,
			href: input.href ?? null,
			entityId: input.entityId ?? null,
			isExternal: input.isExternal ?? false,
			position: siblings.length,
		});

		return { subjectId: input.menuId };
	},

	async postCommit() {
		await dispatchWebhook({ type: "navigation" });
	},
});
