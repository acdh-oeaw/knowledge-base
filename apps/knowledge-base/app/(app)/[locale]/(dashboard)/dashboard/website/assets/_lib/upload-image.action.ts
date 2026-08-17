"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import {
	type GetValidationErrors,
	createActionStateError,
	createActionStateSuccess,
} from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { UploadImageInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/upload-image.schema";
import { imageGridOptions } from "@/config/assets.config";
import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { uploadAsset } from "@/lib/data/assets";
import { db } from "@/lib/db";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { images } from "@/lib/images";
import { createServerAction } from "@/lib/server/create-server-action";

/** Uses createServerAction because the success response carries typed data. */
export const uploadImageAction = createServerAction<
	{ key: string; url: string },
	GetValidationErrors<typeof UploadImageInputSchema>
>(
	// FIXME: should use a coarser-grained "can upload assets" capability instead of requireAdmin
	{ requireAdmin: true },
	async function uploadImageAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();

		const validation = await v.safeParseAsync(UploadImageInputSchema, getFormDataValues(formData), {
			lang: getIntlLanguage(locale),
		});

		if (!validation.success) {
			const errors = v.flatten<typeof UploadImageInputSchema>(validation.issues);
			return createActionStateError({
				formData,
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { file, licenseId, prefix, label, alt, caption } = validation.output;

		const { key } = await uploadAsset({ file, licenseId, prefix, label, alt, caption });
		const { url } = images.generateSignedImageUrl({ key, options: imageGridOptions });

		await recordAuditEvent(db, {
			actorUserId: user?.id,
			action: "create",
			subjectType: "assets",
			subjectId: key,
			summary: getAuditSummaryFromFormData(formData),
		});

		revalidatePath("/[locale]/dashboard/website/assets", "page");
		revalidatePath("/[locale]/dashboard/administrator/persons", "layout");

		return createActionStateSuccess({
			message: t("Successfully uploaded image."),
			data: { key, url },
		});
	},
);
