import {
	countryMembershipRules,
	inactiveUnitRelationRules,
	mutuallyExclusiveUnitRelationRules,
	pairedRelationRules,
	unitRelationRequirementRules,
} from "@dariah-eric/database/integrity-service";
import { describe, expect, it } from "vitest";

import {
	countryRoleDefaultCounterpartRoles,
	countryRoleRuleByRoleType,
	rulesWithoutWizard,
	wizardDefinitions,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-registry";
import { getCountryRoleCounterpartOptions } from "@/lib/data/wizard-preflight";

/**
 * The guided forms exist to prevent the very violations the maintenance dashboard reports after the
 * fact. Both sides therefore have to stay in step: adding a data-integrity rule without deciding
 * whether it needs a wizard — or renaming one out from under a wizard — must fail here rather than
 * silently leave a gap in the guided path.
 */

const allRuleNames = [
	...pairedRelationRules,
	...unitRelationRequirementRules,
	...countryMembershipRules,
	...mutuallyExclusiveUnitRelationRules,
	...inactiveUnitRelationRules,
].map((rule) => rule.name);

const coveredRuleNames: Array<string> = wizardDefinitions.flatMap((wizard) => [
	...wizard.coversRules,
]);

describe("wizard rule coverage", () => {
	it("covers every data-integrity rule with a wizard or an explicit exemption", () => {
		const uncovered = allRuleNames.filter(
			(name) => !coveredRuleNames.includes(name) && !(name in rulesWithoutWizard),
		);

		expect(uncovered).toEqual([]);
	});

	it("only names rules which exist", () => {
		const unknown = [...coveredRuleNames, ...Object.keys(rulesWithoutWizard)].filter(
			(name) => !allRuleNames.includes(name),
		);

		expect(unknown).toEqual([]);
	});

	it("does not cover the same rule from two wizards", () => {
		const duplicates = coveredRuleNames.filter(
			(name, index) => coveredRuleNames.indexOf(name) !== index,
		);

		expect(duplicates).toEqual([]);
	});
});

describe("country-role wizard counterparts", () => {
	it("defaults to a counterpart role which satisfies its paired rule", () => {
		for (const [ruleName, counterpartRole] of Object.entries(countryRoleDefaultCounterpartRoles)) {
			const rule = pairedRelationRules.find((entry) => entry.name === ruleName);

			expect(rule, `no paired-relation rule named "${ruleName}"`).toBeDefined();
			expect(rule?.b.roleTypes).toContain(counterpartRole);
		}
	});

	it("maps every selectable country role to a paired rule with a counterpart", () => {
		for (const [roleType, ruleName] of Object.entries(countryRoleRuleByRoleType)) {
			const rule = pairedRelationRules.find((entry) => entry.name === ruleName);

			expect(rule, `role "${roleType}" maps to unknown rule "${ruleName}"`).toBeDefined();
			// The role the admin picks must be one the rule's own side accepts, otherwise creating it
			// would not satisfy the rule the wizard claims to cover.
			expect(rule?.a.roleTypes).toContain(roleType);
			expect(countryRoleDefaultCounterpartRoles).toHaveProperty(ruleName);
		}
	});

	it("pins the counterpart to a specific governance body", () => {
		for (const ruleName of Object.keys(countryRoleDefaultCounterpartRoles)) {
			const rule = pairedRelationRules.find((entry) => entry.name === ruleName);

			// Without a `unitSlug` the wizard would have no unit to create the counterpart against.
			expect(rule?.b.unitSlug).toBeTypeOf("string");
		}
	});

	/**
	 * The wizard offers whatever its rule accepts, no more and no less: chairing the National
	 * Coordinator Committee counts as being on it, while the General Assembly rule is satisfied by
	 * membership alone. Widening or narrowing a rule must change the form, not silently disagree with
	 * it.
	 */
	it("offers exactly the counterpart roles its rule accepts, including the default", () => {
		const counterpartOptions = getCountryRoleCounterpartOptions();

		for (const [roleType, ruleName] of Object.entries(countryRoleRuleByRoleType)) {
			const rule = pairedRelationRules.find((entry) => entry.name === ruleName);
			const offered = counterpartOptions[roleType as keyof typeof countryRoleRuleByRoleType];

			expect(offered.options).toStrictEqual([...(rule?.b.roleTypes ?? [])]);
			expect(offered.options).toContain(offered.defaultRoleType);
		}
	});

	it("offers a choice for the committee and none for the General Assembly", () => {
		const counterpartOptions = getCountryRoleCounterpartOptions();

		expect(counterpartOptions.national_coordinator.options.length).toBeGreaterThan(1);
		expect(counterpartOptions.national_coordinator.options).toContain("is_chair_of");
		expect(counterpartOptions.national_representative.options).toStrictEqual(["is_member_of"]);
	});
});
