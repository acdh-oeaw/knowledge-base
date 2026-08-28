import { log } from "@acdh-oeaw/lib";

import { env } from "@/config/env.config";
import { email } from "@/lib/email";
import type { IntlLocale } from "@/lib/i18n/locales";
import { createFullUrl } from "@/lib/navigation/create-full-url";
import { getPathname } from "@/lib/navigation/navigation";

interface SendReportSubmittedNotificationParams {
	type: "country_report" | "working_group_report";
	/** Country name, or working group name (may be `null` when the document is unpublished). */
	name: string | null;
	/** Reporting campaign year. */
	year: number;
	/** Dashboard pathname (without locale prefix) pointing at the submitted report. */
	href: string;
	locale: IntlLocale;
	/** The national coordinator / working group chair who submitted the report. */
	submittedBy: {
		name: string;
		email: string;
	};
}

/**
 * Notifies the contact address that a report has transitioned from draft to submitted. Sending is
 * best-effort: a failure is logged but never surfaced to the submitter, so a flaky mail server can
 * not block the submission itself.
 */
export async function sendReportSubmittedNotification(
	params: SendReportSubmittedNotificationParams,
): Promise<void> {
	const { type, name, year, href, locale, submittedBy } = params;

	const isCountryReport = type === "country_report";
	const label = isCountryReport ? "country report" : "working group report";
	const entityLabel = isCountryReport ? "Country" : "Working group";
	const reportName = name ?? "(unknown)";

	const url = String(
		createFullUrl({ pathname: getPathname({ href: { pathname: href }, locale }) }),
	);

	const subject = `New ${label} submitted: ${reportName} (${String(year)})`;
	const text = [
		`A ${label} has been submitted and is awaiting review.`,
		"",
		`${entityLabel}: ${reportName}`,
		`Reporting year: ${String(year)}`,
		`Submitted by: ${submittedBy.name} <${submittedBy.email}>`,
		"",
		`View the report: ${url}`,
	].join("\n");

	const result = await email.sendEmail({
		from: `${submittedBy.name} <${submittedBy.email}>`,
		to: env.EMAIL_ADDRESS,
		subject,
		text,
	});

	if (result.isErr()) {
		log.error("Failed to send report submitted notification email.", result.error);
		return;
	}

	log.info(result.value);
}
