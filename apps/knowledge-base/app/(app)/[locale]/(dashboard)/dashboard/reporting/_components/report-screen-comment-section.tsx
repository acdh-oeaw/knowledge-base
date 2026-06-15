import type { ReactNode } from "react";

import { ReportScreenCommentForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-form";
import {
	type ReportScreenCommentKey,
	type ReportScreenCommentType,
	getReportScreenComment,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_lib/report-screen-comments";

interface ReportScreenCommentSectionProps {
	reportId: string;
	reportType: ReportScreenCommentType;
	screenKey: ReportScreenCommentKey;
}

export async function ReportScreenCommentSection(
	props: Readonly<ReportScreenCommentSectionProps>,
): Promise<ReactNode> {
	const { reportId, reportType, screenKey } = props;

	const comment = await getReportScreenComment(reportType, reportId, screenKey);

	return (
		<ReportScreenCommentForm
			comment={comment}
			reportId={reportId}
			reportType={reportType}
			screenKey={screenKey}
		/>
	);
}
