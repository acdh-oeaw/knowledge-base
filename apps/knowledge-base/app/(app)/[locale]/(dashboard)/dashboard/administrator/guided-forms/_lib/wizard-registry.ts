import type * as schema from "@dariah-eric/database/schema";

/**
 * The guided forms ("wizards") admins can run, and — crucially — which data-integrity rules each
 * one exists to prevent.
 *
 * The rules themselves are declared once, in `@dariah-eric/database/integrity-service`, and are
 * applied _retrospectively_ by the maintenance dashboard and the `@dariah-eric/audit` cli. A wizard
 * is the _prospective_ application of the same declaration: it collects everything a use case needs
 * in one flow so the violation never occurs. A wizard therefore never restates a rule in its own
 * words — it names the rule, and `test/data/wizard-rule-coverage.test.ts` fails if a rule is added
 * without a wizard covering it or an entry in {@link rulesWithoutWizard}.
 *
 * Deliberately free of i18n and React so the coverage test can import it: the user-facing titles
 * and descriptions live with the hub page, which has a `t` binding the message extractor can see.
 */

export interface WizardDefinition {
	id: string;
	/** Route segment below `/dashboard/administrator/guided-forms`. */
	segment: string;
	/** Names of the integrity rules this wizard exists to prevent violations of. */
	coversRules: ReadonlyArray<string>;
}

export const wizardDefinitions = [
	{
		id: "partner-institution",
		segment: "partner-institution",
		coversRules: [
			"dariah-partner-located-in-country",
			"dariah-partner-institution-in-member-country",
			"dariah-cooperating-partner-in-non-member-country",
			"cooperating-partner-excludes-partner-institution",
			"partner-institution-implied-by-national-coordinating-institution",
		],
	},
	{
		id: "country-role",
		segment: "country-role",
		coversRules: ["national-coordinator-ncc", "national-representative-general-assembly"],
	},
	{
		id: "retire-unit",
		segment: "retire-unit",
		coversRules: ["inactive-working-group-relations-closed", "inactive-country-relations-closed"],
	},
] as const satisfies ReadonlyArray<WizardDefinition>;

export type WizardId = (typeof wizardDefinitions)[number]["id"];

/**
 * Rules which deliberately have no wizard, with the reason. Keeping them listed (rather than
 * loosening the coverage test) forces the decision to be made and written down when a rule is
 * added.
 */
export const rulesWithoutWizard: Record<string, string> = {};

export function wizardHref(id: WizardId): string {
	const definition = wizardDefinitions.find((entry) => entry.id === id);

	if (definition == null) {
		throw new Error(`Unknown wizard "${id}".`);
	}

	return `/dashboard/administrator/guided-forms/${definition.segment}`;
}

/**
 * The person role each paired-relation rule's counterpart is created as **by default**.
 *
 * A rule's `b.roleTypes` is the set of roles which _satisfy_ it, not an instruction for what to
 * create, so the wizard offers that set and starts from the value named here. Plain membership is
 * the right default for both rules: chairing is an additional fact about a coordinator, never the
 * assumption. The coverage test asserts each default is one of its rule's accepted role types.
 *
 * Which roles are actually offered is read from the rule itself (see
 * `getCountryRoleCounterpartOptions`) — the General Assembly rule accepts only `is_member_of`, so
 * the wizard offers no choice there, while the National Coordinator Committee rule also accepts
 * chair and vice-chair.
 */
export const countryRoleDefaultCounterpartRoles = {
	"national-coordinator-ncc": "is_member_of",
	"national-representative-general-assembly": "is_member_of",
} as const satisfies Record<string, (typeof schema.personRoleTypesEnum)[number]>;

export type CountryRoleRuleName = keyof typeof countryRoleDefaultCounterpartRoles;

/**
 * The country role an admin picks in the country-role wizard, and the paired rule it triggers.
 * Deputies pair with the same governance body as the principal role.
 */
export const countryRoleRuleByRoleType = {
	national_coordinator: "national-coordinator-ncc",
	national_coordinator_deputy: "national-coordinator-ncc",
	national_representative: "national-representative-general-assembly",
	national_representative_deputy: "national-representative-general-assembly",
} as const satisfies Record<string, CountryRoleRuleName>;

export type CountryRoleType = keyof typeof countryRoleRuleByRoleType;

export const countryRoleTypes = Object.keys(countryRoleRuleByRoleType) as Array<CountryRoleType>;
