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

import type { ServerAction } from "@/lib/server/create-server-action";

interface Question {
	id: string;
	question: unknown;
	position: number;
}

interface WorkingGroupReportQuestionsFormProps {
	reportId: string;
	questions: Array<Question>;
	answerMap: Record<string, unknown>;
	formAction: ServerAction;
}

export function WorkingGroupReportQuestionsForm(
	props: Readonly<WorkingGroupReportQuestionsFormProps>,
): ReactNode {
	const { reportId, questions, answerMap, formAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	return (
		<Form action={action} className="flex flex-col gap-y-8 max-inline-3xl" state={state}>
			<input name="id" type="hidden" value={reportId} />

			{questions.map((question) => {
				const existingAnswer = answerMap[question.id];

				return (
					<section key={question.id} className="flex flex-col gap-y-4">
						<div className="rounded-md border border-border bg-muted/30 p-4">
							<RichTextEditor
								aria-label={`Question ${String(question.position)}`}
								content={question.question as JSONContent}
								isEditable={false}
								size="sm"
							/>
						</div>
						<RichTextEditor
							aria-label={`Answer to question ${String(question.position)}`}
							content={existingAnswer ?? undefined}
							name={`answers.${question.id}`}
						/>
					</section>
				);
			})}

			<div className="flex flex-col gap-y-3">
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
			</div>
		</Form>
	);
}
