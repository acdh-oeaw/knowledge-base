import { describe, expect, it } from "vitest";

import { getCountryReportServiceSeedIds } from "@/lib/data/report-services";

describe("country report service membership", () => {
	it("seeds the distinct union of consortium and carried services", () => {
		const ids = getCountryReportServiceSeedIds(
			[
				{ id: "consortium-only", name: "Consortium service" },
				{ id: "shared", name: "Shared service" },
			],
			[
				{ id: "shared", name: "Shared service" },
				{ id: "carried-only", name: "Carried service" },
			],
		);

		expect(ids).toEqual(["consortium-only", "shared", "carried-only"]);
	});

	it("supports reports with no service candidates", () => {
		expect(getCountryReportServiceSeedIds([], [])).toEqual([]);
	});
});
