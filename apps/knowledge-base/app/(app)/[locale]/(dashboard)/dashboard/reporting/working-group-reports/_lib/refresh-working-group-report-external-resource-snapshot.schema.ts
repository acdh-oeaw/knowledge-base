import * as v from "valibot";

import { workingGroupExternalResourceSnapshotSections } from "@/lib/data/report-marketplace-resources";

export const RefreshWorkingGroupReportExternalResourceSnapshotActionInputSchema = v.object({
	section: v.picklist(workingGroupExternalResourceSnapshotSections),
	workingGroupReportId: v.pipe(v.string(), v.uuid()),
});
