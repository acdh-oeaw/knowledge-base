"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { CreateSocialMediaActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/social-media/_lib/create-social-media.schema";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createSocialMediaAction = createMutationAction({
	schema: CreateSocialMediaActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "social_media" },
	revalidate: "/[locale]/dashboard/administrator/social-media",
	redirect: "/dashboard/administrator/social-media",

	async mutate(tx, input) {
		const socialMediaType = await tx.query.socialMediaTypes.findFirst({
			where: { type: input.type },
			columns: { id: true },
		});
		assert(socialMediaType, "Social media type not found.");

		const durationValue =
			input.duration?.start != null
				? { start: input.duration.start, end: input.duration.end }
				: null;

		const [created] = await tx
			.insert(schema.socialMedia)
			.values({
				name: input.name,
				url: input.url,
				typeId: socialMediaType.id,
				duration: durationValue,
			})
			.returning({ id: schema.socialMedia.id });
		assert(created);

		return { subjectId: created.id };
	},
});
