import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { RichTextView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/rich-text-view";
import { ReportSummarySection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-summary-section";
import type {
	ReportScreenCommentKey,
	ReportScreenCommentView,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_lib/report-screen-comments";

export const reportCommentsSectionId = "report-comments";

interface ReportCommentsSectionProps {
	comments: ReadonlyArray<ReportScreenCommentView>;
}

export async function ReportCommentsSection(
	props: Readonly<ReportCommentsSectionProps>,
): Promise<ReactNode> {
	const { comments } = props;

	if (comments.length === 0) {
		return null;
	}

	const t = await getExtracted();
	const labels: Record<ReportScreenCommentKey, string> = {
		institutions: t("Partner institutions"),
		contributors: t("Contributors"),
		events: t("Events"),
		"social-media": t("Social media"),
		services: t("Services"),
		software: t("SSHOC resources"),
		publications: t("Publications"),
		projects: t("Projects"),
		data: t("Data"),
		questions: t("Questions"),
		confirm: t("Summary"),
	};

	return (
		<ReportSummarySection
			className="mbs-0"
			contentClassName="gap-y-6"
			id={reportCommentsSectionId}
			title={t("Comments")}
		>
			{comments.map((item) => (
				<div key={item.screenKey} className="flex flex-col gap-y-2">
					<h3 className="text-sm font-medium text-fg">{labels[item.screenKey]}</h3>
					<div className="rounded-md border border-border px-4 py-3">
						<RichTextView
							ariaLabel={t("Comment for {section}", { section: labels[item.screenKey] })}
							content={item.comment}
							size="sm"
						/>
					</div>
				</div>
			))}
		</ReportSummarySection>
	);
}
