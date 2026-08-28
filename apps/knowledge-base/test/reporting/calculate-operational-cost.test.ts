import { describe, expect, it } from "vitest";

import {
	type OperationalCostCampaignData,
	type OperationalCostInput,
	calculateOperationalCost,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/calculate-operational-cost";

/**
 * Campaign amounts mirroring the DARIAH policy lump sums (66000 EUR / FTE → 5500 EUR / person
 * month, +25% overhead on services). The exact numbers only need to be internally consistent for
 * the assertions below.
 */
const campaign: OperationalCostCampaignData = {
	contributionAmounts: [
		{ roleType: "national_coordinator", amount: 11000 }, // 2 PM
		{ roleType: "national_coordinator_deputy", amount: 2500 }, // 0.45 PM
		{ roleType: "is_chair_of_ncc", amount: 5500 }, // 1 PM
		{ roleType: "is_member_of_jrc", amount: 8250 }, // 1.5 PM
		{ roleType: "is_chair_of_jrc", amount: 5500 }, // 1 PM
		{ roleType: "is_chair_of_wg", amount: 5500 }, // 1 PM
	],
	eventAmounts: [
		{ eventType: "small", amount: 500 },
		{ eventType: "medium", amount: 2500 },
		{ eventType: "large", amount: 5000 },
		{ eventType: "very_large", amount: 10000 },
		{ eventType: "dariah_commissioned", amount: 50000 },
	],
	socialMediaAmounts: [
		{ category: "website", amount: 5000 },
		{ category: "other", amount: 2000 },
	],
	serviceSizes: [
		{ serviceSize: "small", visitsThreshold: null, amount: 6875 }, // 1 PM + 25%
		{ serviceSize: "medium", visitsThreshold: 7000, amount: 20625 }, // 3 PM + 25%
		{ serviceSize: "large", visitsThreshold: 170000, amount: 41250 }, // 6 PM + 25%
		{ serviceSize: "core", visitsThreshold: null, amount: 82500 }, // 12 PM + 25%
	],
	countryThresholds: [
		{ countryDocumentId: "country-1", amount: 50000 },
		{ countryDocumentId: "country-2", amount: 12345 },
	],
};

function makeInput(overrides: Partial<OperationalCostInput> = {}): OperationalCostInput {
	return {
		contributions: [],
		smallEvents: null,
		mediumEvents: null,
		largeEvents: null,
		veryLargeEvents: null,
		dariahCommissionedEvent: null,
		socialMediaAccounts: [],
		services: [],
		campaign,
		countryDocumentId: "country-1",
		...overrides,
	};
}

describe("calculateOperationalCost", () => {
	it("sums contributions, events, social media and services per the policy formula", () => {
		const result = calculateOperationalCost(
			makeInput({
				contributions: [
					{ compensationRole: "national_coordinator" },
					{ compensationRole: "national_coordinator_deputy" },
					{ compensationRole: "is_chair_of_wg" },
					// Uncompensated relations carry no lump sum and must be ignored.
					{ compensationRole: null },
				],
				smallEvents: 2,
				mediumEvents: 1,
				largeEvents: 0,
				veryLargeEvents: 1,
				dariahCommissionedEvent: "Annual national event",
				socialMediaAccounts: [
					{
						socialMediaId: "w1",
						name: "National website",
						type: "website",
						kpis: [{ value: 1200 }],
					},
					{ socialMediaId: "s1", name: "Mastodon", type: "mastodon", kpis: [{ value: 300 }] },
					{ socialMediaId: "s2", name: "Bluesky", type: "bluesky", kpis: [{ value: 80 }] },
				],
				services: [
					{
						serviceId: "svc-small",
						name: "Small service",
						serviceType: "community",
						kpis: [{ kpi: "visits", value: 5000 }],
					},
					{
						serviceId: "svc-large",
						name: "Large service",
						serviceType: "community",
						kpis: [{ kpi: "visits", value: 200000 }],
					},
				],
			}),
		);

		// contributions 11000 + 2500 + 5500 = 19000
		// events 2*500 + 1*2500 + 1*10000 + dariah 50000 = 63500
		// social media: website 5000 (once) + other 2000 (once, not per account) = 7000
		// services small 6875 + large 41250 = 48125
		expect(result.total).toBe(19000 + 63500 + 7000 + 48125);
		expect(result.threshold).toBe(50000);
	});

	it("counts social media once per category regardless of how many accounts are reported", () => {
		const result = calculateOperationalCost(
			makeInput({
				socialMediaAccounts: [
					{ socialMediaId: "s1", name: "X", type: "x", kpis: [{ value: 10 }] },
					{ socialMediaId: "s2", name: "Mastodon", type: "mastodon", kpis: [{ value: 20 }] },
					{ socialMediaId: "s3", name: "LinkedIn", type: "linkedin", kpis: [{ value: 30 }] },
				],
			}),
		);

		const socialLines = result.lines.filter((line) => line.key.startsWith("social-media-"));
		expect(socialLines).toHaveLength(1);
		expect(socialLines[0]).toMatchObject({ key: "social-media-other", quantity: 1, total: 2000 });
		expect(result.total).toBe(2000);
	});

	it("counts website and social media as separate single lump sums", () => {
		const result = calculateOperationalCost(
			makeInput({
				socialMediaAccounts: [
					{ socialMediaId: "w1", name: "Website", type: "website", kpis: [{ value: 5 }] },
					{ socialMediaId: "s1", name: "X", type: "x", kpis: [{ value: 5 }] },
				],
			}),
		);

		expect(result.total).toBe(5000 + 2000);
	});

	it("ignores social media accounts without any positive KPI", () => {
		const result = calculateOperationalCost(
			makeInput({
				socialMediaAccounts: [
					{ socialMediaId: "w1", name: "Website", type: "website", kpis: [{ value: 0 }] },
					{ socialMediaId: "s1", name: "X", type: "x", kpis: [] },
				],
			}),
		);

		expect(result.lines.filter((line) => line.key.startsWith("social-media-"))).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("does not include project contributions in the operational cost", () => {
		const withProjects = makeInput({
			// Project contributions are intentionally not part of OperationalCostInput; they must never
			// affect the total even if callers spread extra fields in.
			...({
				projectContributions: [{ id: "p1", projectName: "Big project", amountEuros: 99999 }],
			} as Partial<OperationalCostInput>),
			contributions: [{ compensationRole: "national_coordinator" }],
		});

		const result = calculateOperationalCost(withProjects);

		expect(result.lines.some((line) => line.key.startsWith("project-"))).toBe(false);
		expect(result.total).toBe(11000);
	});

	it("sizes a service by its visits, matching the highest threshold it reaches", () => {
		const result = calculateOperationalCost(
			makeInput({
				services: [
					{
						serviceId: "a",
						name: "Below medium",
						serviceType: "community",
						kpis: [{ kpi: "visits", value: 6999 }],
					},
					{
						serviceId: "b",
						name: "Medium",
						serviceType: "community",
						kpis: [{ kpi: "visits", value: 7000 }],
					},
					{
						serviceId: "c",
						name: "Large",
						serviceType: "community",
						kpis: [{ kpi: "visits", value: 170000 }],
					},
					// No visits KPI → treated as 0 visits → smallest size.
					{
						serviceId: "d",
						name: "No visits",
						serviceType: "community",
						kpis: [{ kpi: "downloads", value: 999999 }],
					},
				],
			}),
		);

		const byKey = new Map(result.lines.map((line) => [line.key, line]));
		expect(byKey.get("services-small")).toMatchObject({
			label: "Small services",
			quantity: 2,
			showQuantity: true,
			unitAmount: 6875,
			total: 13750,
		});
		expect(byKey.get("services-medium")).toMatchObject({ quantity: 1, unitAmount: 20625 });
		expect(byKey.get("services-large")).toMatchObject({ quantity: 1, unitAmount: 41250 });
	});

	it("counts core services with the core lump sum regardless of visits", () => {
		const result = calculateOperationalCost(
			makeInput({
				services: [
					{
						serviceId: "core-low-visits",
						name: "Core service",
						serviceType: "core",
						kpis: [{ kpi: "visits", value: 12 }],
					},
					{
						serviceId: "community-high-visits",
						name: "Community service",
						serviceType: "community",
						kpis: [{ kpi: "visits", value: 200000 }],
					},
				],
			}),
		);

		const byKey = new Map(result.lines.map((line) => [line.key, line]));
		expect(byKey.get("services-core")).toMatchObject({ quantity: 1, unitAmount: 82500 });
		expect(byKey.get("services-large")).toMatchObject({ quantity: 1, unitAmount: 41250 });
		expect(result.total).toBe(82500 + 41250);
	});

	it("returns a null threshold when the country has no configured threshold", () => {
		const result = calculateOperationalCost(makeInput({ countryDocumentId: "country-unknown" }));

		expect(result.threshold).toBeNull();
		expect(result.total).toBe(0);
		expect(result.lines).toEqual([]);
	});
});
