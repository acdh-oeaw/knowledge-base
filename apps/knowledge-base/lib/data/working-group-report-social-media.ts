import { db } from "@/lib/db";

/**
 * The social media account ids covered by a previous working group report — used to carry the
 * membership over to a new report at creation, so reporters don't re-select the same accounts each
 * year.
 */
export async function getCarriedOverWorkingGroupReportSocialMedia(
	previousReportId: string,
): Promise<Array<string>> {
	const rows = await db.query.workingGroupReportSocialMedia.findMany({
		where: { workingGroupReportId: previousReportId },
		columns: { socialMediaId: true },
	});
	return rows.map((row) => row.socialMediaId);
}
