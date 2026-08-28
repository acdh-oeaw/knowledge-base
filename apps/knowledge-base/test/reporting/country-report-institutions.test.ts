import { describe, expect, it } from "vitest";

import { groupCountryReportInstitutionSummaryRows } from "@/lib/data/country-report-institutions";

describe("country report institutions", () => {
	it("lists an institution once with all captured representation types", () => {
		const institutions = groupCountryReportInstitutionSummaryRows([
			{
				id: "row-1",
				organisationalUnitDocumentId: "institution-1",
				representationType: "is_national_representative_institution_in",
				organisationalUnit: { name: "Austrian Academy of Sciences", acronym: "OEAW" },
			},
			{
				id: "row-2",
				organisationalUnitDocumentId: "institution-1",
				representationType: "is_national_coordinating_institution_in",
				organisationalUnit: { name: "Austrian Academy of Sciences", acronym: "OEAW" },
			},
			{
				id: "row-3",
				organisationalUnitDocumentId: "institution-1",
				representationType: "is_national_representative_institution_in",
				organisationalUnit: { name: "Austrian Academy of Sciences", acronym: "OEAW" },
			},
		]);

		expect(institutions).toEqual([
			{
				id: "row-1",
				name: "Austrian Academy of Sciences",
				acronym: "OEAW",
				representationTypes: [
					"is_national_coordinating_institution_in",
					"is_national_representative_institution_in",
				],
			},
		]);
	});
});
