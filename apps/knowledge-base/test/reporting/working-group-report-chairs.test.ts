import { describe, expect, it } from "vitest";

import { getWorkingGroupChairSnapshotDrift } from "@/lib/data/working-group-report-chairs";

describe("working group report chair snapshots", () => {
	it("keeps a captured role historical when the underlying relation role changes", () => {
		const drift = getWorkingGroupChairSnapshotDrift(
			[
				{
					id: "snapshot-id",
					personToOrgUnitId: "relation-id",
					personName: "Ada Lovelace",
					personSlug: "ada-lovelace",
					chairRole: "is_chair_of",
				},
			],
			[
				{
					personToOrgUnitId: "relation-id",
					personName: "Ada Lovelace",
					personSlug: "ada-lovelace",
					chairRole: "is_vice_chair_of",
				},
			],
		);

		expect(drift.chairs).toMatchObject([{ chairRole: "is_chair_of", isCurrent: false }]);
		expect(drift.missing).toMatchObject([{ chairRole: "is_vice_chair_of" }]);
	});

	it("recognizes an unchanged captured relation", () => {
		const chair = {
			personToOrgUnitId: "relation-id",
			personName: "Ada Lovelace",
			personSlug: "ada-lovelace",
			chairRole: "is_chair_of" as const,
		};

		const drift = getWorkingGroupChairSnapshotDrift([{ id: "snapshot-id", ...chair }], [chair]);

		expect(drift.chairs[0]?.isCurrent).toBe(true);
		expect(drift.missing).toEqual([]);
	});
});
