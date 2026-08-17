"use client";

import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { RichTextEditor } from "@dariah-eric/ui/rich-text-editor";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { deleteWorkingGroupReportQuestionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/delete-working-group-report-question.action";
import type { ServerAction } from "@/lib/server/create-server-action";

interface CampaignQuestionsFormProps {
	campaignId: string;
	questions: Array<Pick<schema.WorkingGroupReportQuestion, "id" | "question" | "position">>;
	createAction: ServerAction;
}

export function CampaignQuestionsForm(props: Readonly<CampaignQuestionsFormProps>): ReactNode {
	const { campaignId, questions, createAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(createAction, createActionStateInitial());

	return (
		<div className="flex flex-col gap-y-8">
			{questions.length === 0 ? (
				<p className="text-sm text-muted-fg">{t("No questions yet.")}</p>
			) : (
				<ol className="flex flex-col gap-y-4">
					{questions.map((q) => (
						<li key={q.id} className="flex items-start gap-x-4 rounded-md border border-border p-4">
							<div className="flex-1 space-y-2">
								<span className="text-xs text-muted-fg">
									{t("Question")} {q.position}
								</span>
								<div className="richtext richtext-sm">
									<RichTextEditor
										aria-label={t("Question")}
										content={q.question}
										isEditable={false}
									/>
								</div>
							</div>

							<form action={deleteWorkingGroupReportQuestionAction}>
								<input name="campaignId" type="hidden" value={campaignId} />
								<input name="id" type="hidden" value={q.id} />
								<Button intent="danger" size="sm" type="submit">
									{t("Remove")}
								</Button>
							</form>
						</li>
					))}
				</ol>
			)}

			<FormLayout variant="stacked">
				<Form action={action} className="flex flex-col gap-y-6" state={state}>
					<input name="campaignId" type="hidden" value={campaignId} />

					<FormSection title={t("Add question")}>
						<RichTextEditor aria-label={t("Question")} name="question" />
					</FormSection>

					<Button className="self-start" isPending={isPending} type="submit">
						{isPending ? (
							<Fragment>
								<ProgressCircle aria-label={t("Adding...")} isIndeterminate={true} />
								<span aria-hidden={true}>{t("Adding...")}</span>
							</Fragment>
						) : (
							t("Add")
						)}
					</Button>

					<FormStatus className="self-start" state={state} />
				</Form>
			</FormLayout>
		</div>
	);
}
