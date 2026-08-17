"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { RichTextEditor } from "@dariah-eric/ui/rich-text-editor";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import type {
	ReportScreenCommentKey,
	ReportScreenCommentType,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_lib/report-screen-comments";
import { upsertReportScreenCommentAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_lib/upsert-report-screen-comment.action";

interface ReportScreenCommentFormProps {
	comment: JSONContent | null;
	reportId: string;
	reportType: ReportScreenCommentType;
	screenKey: ReportScreenCommentKey;
}

export function ReportScreenCommentForm(props: Readonly<ReportScreenCommentFormProps>): ReactNode {
	const { comment, reportId, reportType, screenKey } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(
		upsertReportScreenCommentAction,
		createActionStateInitial(),
	);

	return (
		<section className="flex flex-col gap-y-4 border-bs pbs-6">
			<h2 className="text-sm font-semibold text-fg">{t("Comment")}</h2>

			<Form action={action} className="flex flex-col gap-y-4 max-inline-3xl" state={state}>
				<input name="reportId" type="hidden" value={reportId} />
				<input name="reportType" type="hidden" value={reportType} />
				<input name="screenKey" type="hidden" value={screenKey} />

				<RichTextEditor aria-label={t("Comment")} content={comment ?? undefined} name="comment" />

				<Button className="self-start" isPending={isPending} type="submit">
					{isPending ? (
						<Fragment>
							<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
							<span aria-hidden={true}>{t("Saving...")}</span>
						</Fragment>
					) : (
						t("Save")
					)}
				</Button>

				<FormStatus className="self-start" state={state} />
			</Form>
		</section>
	);
}
