"use server";

import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";
import { getExtracted } from "next-intl/server";
import * as v from "valibot";

import { isEmptyRichTextDocument } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_lib/report-screen-comments";
import { assertCan } from "@/lib/auth/permissions";
import { and, eq } from "@/lib/db/sql";
import { sendReportCommentNotification } from "@/lib/email/send-report-comment-notification";
import { createMutationAction } from "@/lib/server/create-mutation-action";

const UpsertReportScreenCommentActionInputSchema = v.object({
	reportId: v.pipe(v.string(), v.uuid()),
	reportType: v.picklist(schema.reportScreenCommentTypeEnum),
	screenKey: v.picklist(schema.reportScreenCommentKeyEnum),
	comment: v.optional(
		v.pipe(
			v.string(),
			v.rawTransform(({ dataset, addIssue, NEVER }) => {
				if (dataset.value.trim() === "") {
					return null;
				}
				try {
					return JSON.parse(dataset.value) as JSONContent;
				} catch {
					addIssue({ message: "Invalid or missing fields." });
					return NEVER;
				}
			}),
		),
	),
});

export const upsertReportScreenCommentAction = createMutationAction({
	schema: UpsertReportScreenCommentActionInputSchema,
	requireAuth: true,
	audit: { action: "update", subjectType: "report_screen_comment" },
	revalidate: "/[locale]/dashboard/reporting",

	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", {
			type: input.reportType === "country" ? "country_report" : "working_group_report",
			id: input.reportId,
		});
		return undefined;
	},

	// Deferred, best-effort notification. Only fires when the comment was set/updated to a non-empty
	// value, never when it was cleared.
	postCommit({ input, ctx }) {
		const comment = input.comment;
		if (comment == null || isEmptyRichTextDocument(comment)) {
			return;
		}

		return sendReportCommentNotification({
			reportType: input.reportType,
			reportId: input.reportId,
			screenKey: input.screenKey,
			comment,
			locale: ctx.locale,
			editedBy: { name: ctx.user.name, email: ctx.user.email },
		});
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		const comment = input.comment ?? null;

		if (isEmptyRichTextDocument(comment)) {
			await tx
				.delete(schema.reportScreenComments)
				.where(
					and(
						eq(schema.reportScreenComments.reportType, input.reportType),
						eq(schema.reportScreenComments.reportId, input.reportId),
						eq(schema.reportScreenComments.screenKey, input.screenKey),
					),
				);
		} else {
			await tx
				.insert(schema.reportScreenComments)
				.values({
					reportType: input.reportType,
					reportId: input.reportId,
					screenKey: input.screenKey,
					comment,
				})
				.onConflictDoUpdate({
					target: [
						schema.reportScreenComments.reportType,
						schema.reportScreenComments.reportId,
						schema.reportScreenComments.screenKey,
					],
					set: {
						comment,
						updatedAt: new Date(),
					},
				});
		}

		return { subjectId: input.reportId, successMessage: t("Saved.") };
	},
});
