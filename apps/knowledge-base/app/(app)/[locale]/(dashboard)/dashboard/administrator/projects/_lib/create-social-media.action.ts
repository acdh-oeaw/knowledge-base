"use server";

import { assert, getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import * as v from "valibot";

import { CreateSocialMediaSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/create-social-media.schema";
import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { db } from "@/lib/db";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

export interface CreatedSocialMedia {
	id: string;
	name: string;
	url: string;
	type: { type: string };
}

/** Uses createServerAction because the success response carries typed data. */
export const createSocialMediaAction = createServerAction<CreatedSocialMedia>(
	{ requireAdmin: true },
	async function createSocialMediaAction(_state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();

		const result = await v.safeParseAsync(CreateSocialMediaSchema, getFormDataValues(formData), {
			lang: getIntlLanguage(locale),
		});

		if (!result.success) {
			const errors = v.flatten<typeof CreateSocialMediaSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { name, url, type, duration } = result.output;

		const socialMediaType = await db.query.socialMediaTypes.findFirst({
			where: { type },
			columns: { id: true },
		});

		if (socialMediaType == null) {
			return createActionStateError({ message: t("Invalid social media type.") });
		}

		const created = await db.transaction(async (tx) => {
			const [row] = await tx
				.insert(schema.socialMedia)
				.values({
					name,
					url,
					typeId: socialMediaType.id,
					duration: duration?.start != null ? { start: duration.start, end: duration.end } : null,
				})
				.returning({ id: schema.socialMedia.id });
			assert(row);

			await recordAuditEvent(tx, {
				actorUserId: user?.id,
				action: "create",
				subjectType: "projects",
				subjectId: row.id,
				summary: getAuditSummaryFromFormData(formData),
			});

			return row;
		});

		return createActionStateSuccess({
			data: { id: created.id, name, url, type: { type } },
		});
	},
);
