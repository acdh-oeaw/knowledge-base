import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { WorkingGroupReportQuestionsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/working-group-report-questions-form";
import { getAuthorizedWorkingGroupReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/get-working-group-report-summary-data";
import { upsertWorkingGroupReportAnswersAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/upsert-working-group-report-answers.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";

interface WorkingGroupReportQuestionsScreenProps {
	reportId: string;
	/** Edit base path; the save action returns here (e.g. `${basePath}/questions`). */
	basePath: string;
}

/** Shared "questions" screen. See {@link getAuthorizedWorkingGroupReportForUser} for authorization. */
export async function WorkingGroupReportQuestionsScreen(
	props: Readonly<WorkingGroupReportQuestionsScreenProps>,
): Promise<ReactNode> {
	const { reportId, basePath } = props;

	const { user } = await assertAuthenticated();
	const result = await getAuthorizedWorkingGroupReportForUser(
		user,
		reportId,
		(id) =>
			db.query.workingGroupReports.findFirst({
				where: { id },
				columns: { id: true, campaignId: true },
				with: {
					answers: {
						columns: { id: true, questionId: true, answer: true },
					},
				},
			}),
		"update",
	);

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;
	if (report == null) {
		notFound();
	}

	const questions = await db.query.workingGroupReportQuestions.findMany({
		where: { campaignId: report.campaignId },
		columns: { id: true, question: true, position: true },
		orderBy: { position: "asc" },
	});

	const t = await getExtracted();

	if (questions.length === 0) {
		return (
			<div className="flex flex-col gap-y-12">
				<p className="text-sm text-muted-fg">
					{t("No questions have been added for this campaign yet.")}
				</p>

				<ReportScreenCommentSection
					reportId={report.id}
					reportType="working_group"
					screenKey="questions"
				/>
			</div>
		);
	}

	const answerMap = new Map(report.answers.map((a) => [a.questionId, a.answer]));

	return (
		<div className="flex flex-col gap-y-12">
			<WorkingGroupReportQuestionsForm
				answerMap={Object.fromEntries(answerMap)}
				formAction={upsertWorkingGroupReportAnswersAction}
				questions={questions}
				redirectTo={`${basePath}/questions`}
				reportId={report.id}
			/>

			<ReportScreenCommentSection
				reportId={report.id}
				reportType="working_group"
				screenKey="questions"
			/>
		</div>
	);
}
