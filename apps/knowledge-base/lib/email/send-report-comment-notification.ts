import { log } from "@acdh-oeaw/lib";
import type { JSONContent } from "@tiptap/core";

import type {
	ReportScreenCommentKey,
	ReportScreenCommentType,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_lib/report-screen-comments";
import { richTextToText } from "@/app/api/reporting/_lib/rich-text-to-text";
import { env } from "@/config/env.config";
import {
	getCountryReportEditHrefById,
	getWorkingGroupReportEditHrefById,
} from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { email } from "@/lib/email";
import type { IntlLocale } from "@/lib/i18n/locales";
import { createFullUrl } from "@/lib/navigation/create-full-url";
import { getPathname } from "@/lib/navigation/navigation";

const screenLabels: Record<ReportScreenCommentKey, string> = {
	institutions: "Institutions",
	contributors: "Contributors",
	events: "Events",
	"social-media": "Social media",
	services: "Services",
	software: "Software",
	publications: "Publications",
	projects: "Projects",
	data: "Data",
	questions: "Questions",
	confirm: "Confirmation",
};

interface SendReportCommentNotificationParams {
	reportType: ReportScreenCommentType;
	reportId: string;
	screenKey: ReportScreenCommentKey;
	/** The non-empty comment that was just set or updated. */
	comment: JSONContent;
	locale: IntlLocale;
	/** The user who edited the comment. */
	editedBy: {
		name: string;
		email: string;
	};
}

/**
 * Notifies the contact address that a per-screen comment on a report was set or updated to a
 * non-empty value. Like {@link import("./send-report-submitted-notification")}, sending is
 * best-effort: failures are logged but never surfaced to the editor.
 */
export async function sendReportCommentNotification(
	params: SendReportCommentNotificationParams,
): Promise<void> {
	const { reportType, reportId, screenKey, comment, locale, editedBy } = params;

	const isCountryReport = reportType === "country";
	const label = isCountryReport ? "country report" : "working group report";
	const entityLabel = isCountryReport ? "Country" : "Working group";
	const screenLabel = screenLabels[screenKey];

	let resolved: { name: string | null; year: number; href: string } | null;

	if (isCountryReport) {
		const report = await db.query.countryReports.findFirst({
			where: { id: reportId },
			columns: {},
			with: {
				campaign: { columns: { year: true } },
				country: { columns: { name: true } },
			},
		});
		resolved =
			report == null
				? null
				: {
						name: report.country?.name ?? null,
						year: report.campaign.year,
						href: await getCountryReportEditHrefById(reportId, screenKey),
					};
	} else {
		const report = await db.query.workingGroupReports.findFirst({
			where: { id: reportId },
			columns: {},
			with: {
				campaign: { columns: { year: true } },
				workingGroup: { columns: { name: true } },
			},
		});
		resolved =
			report == null
				? null
				: {
						name: report.workingGroup?.name ?? null,
						year: report.campaign.year,
						href: await getWorkingGroupReportEditHrefById(reportId, screenKey),
					};
	}

	if (resolved == null) {
		return;
	}

	const reportName = resolved.name ?? "(unknown)";
	const commentText = richTextToText(comment);
	const url = String(
		createFullUrl({ pathname: getPathname({ href: { pathname: resolved.href }, locale }) }),
	);

	const subject = `Comment updated on ${label}: ${reportName} (${String(resolved.year)}) — ${screenLabel}`;
	const text = [
		`A comment was set or updated on the ${screenLabel.toLowerCase()} section of a ${label}.`,
		"",
		`${entityLabel}: ${reportName}`,
		`Reporting year: ${String(resolved.year)}`,
		`Section: ${screenLabel}`,
		`Edited by: ${editedBy.name} <${editedBy.email}>`,
		"",
		"Comment:",
		commentText,
		"",
		`View the report: ${url}`,
	].join("\n");

	const result = await email.sendEmail({
		from: `${editedBy.name} <${editedBy.email}>`,
		to: env.EMAIL_ADDRESS,
		subject,
		text,
	});

	if (result.isErr()) {
		log.error("Failed to send report comment notification email.", result.error);
		return;
	}

	log.info(result.value);
}
