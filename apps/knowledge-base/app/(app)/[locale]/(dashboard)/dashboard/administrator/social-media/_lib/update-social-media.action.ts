"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateSocialMediaActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/social-media/_lib/update-social-media.schema";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateSocialMediaAction = createMutationAction({
	schema: UpdateSocialMediaActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "social_media" },
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

		await tx
			.update(schema.socialMedia)
			.set({
				name: input.name,
				url: input.url,
				typeId: socialMediaType.id,
				duration: durationValue,
			})
			.where(eq(schema.socialMedia.id, input.id));

		return { subjectId: input.id };
	},
});
