"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { CreateNavigationMenuActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_lib/create-navigation-menu.schema";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const createNavigationMenuAction = createMutationAction({
	schema: CreateNavigationMenuActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "navigation" },
	revalidate: "/[locale]/dashboard/website/navigation",

	async mutate(tx, input) {
		const [menu] = await tx
			.insert(schema.navigationMenus)
			.values({ name: input.name })
			.returning({ id: schema.navigationMenus.id });
		assert(menu);

		return { subjectId: menu.id };
	},

	async postCommit() {
		await dispatchWebhook({ type: "navigation" });
	},
});
