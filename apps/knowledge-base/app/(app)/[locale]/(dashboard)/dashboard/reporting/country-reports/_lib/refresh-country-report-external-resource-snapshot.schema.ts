import * as v from "valibot";

import { countryExternalResourceSnapshotSections } from "@/lib/data/report-marketplace-resources";

export const RefreshCountryReportExternalResourceSnapshotActionInputSchema = v.object({
	countryReportId: v.pipe(v.string(), v.uuid()),
	section: v.picklist(countryExternalResourceSnapshotSections),
});
