"use client";

import { Note } from "@dariah-eric/ui/note";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { WizardPeriod } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_components/wizard-review";
import type { WizardWarning } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-plan";

/**
 * Renders what the data-integrity rules say about the choices made so far, before anything is
 * written. The rules are declared once in `@dariah-eric/database/integrity-service` and evaluated
 * by the wizard preflight; this component only phrases the outcome.
 *
 * These are warnings, not blocks. The rules describe how the data should normally look, and admins
 * legitimately need to record exceptions — being told about the conflict at the moment of entry is
 * what prevents the accidental ones.
 */

interface WizardWarningsProps {
	warnings: ReadonlyArray<WizardWarning>;
}

export function WizardWarnings(props: Readonly<WizardWarningsProps>): ReactNode {
	const { warnings } = props;

	if (warnings.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3">
			{warnings.map((warning) => (
				<Note key={warning.id} intent={warning.severity === "warning" ? "warning" : "info"}>
					<WizardWarningMessage warning={warning} />
					{warning.periods != null && warning.periods.length > 0 ? (
						<p className="mbs-1 text-xs text-muted-fg">
							<WizardWarningPeriods periods={warning.periods} />
						</p>
					) : null}
				</Note>
			))}
		</div>
	);
}

function WizardWarningMessage(props: Readonly<{ warning: WizardWarning }>): ReactNode {
	const { warning } = props;

	const t = useExtracted();
	const {
		country = "",
		institution = "",
		person = "",
		relation = "",
		other = "",
		unit = "",
	} = warning.values;

	switch (warning.code) {
		case "country_not_member": {
			return t(
				"{institution} would hold the status {relation} towards DARIAH-EU, but {country} is not recorded as a member or observer of DARIAH-EU for the whole period.",
				{ country, institution, relation },
			);
		}
		case "country_is_member": {
			return t(
				"{institution} would be recorded as a cooperating partner, but {country} is a member or observer of DARIAH-EU. Institutions in member countries are normally partner institutions instead.",
				{ country, institution },
			);
		}
		case "relation_implies_other": {
			return t(
				"{relation} already implies {other}, so {other} is not offered here and does not need to be recorded separately.",
				{ other, relation },
			);
		}
		case "relation_conflicts": {
			return t("{unit} already holds {other}, which {relation} excludes.", {
				other,
				relation,
				unit,
			});
		}
		case "counterpart_duration_mismatch": {
			return t(
				"{person} is already {relation} {unit}, but over a different period. Submitting will extend it to match the dates entered here.",
				{ person, relation, unit },
			);
		}
		case "counterpart_absent": {
			return t(
				"{person} holds no open membership of the governance body that {relation} pairs with, so there is nothing to end there.",
				{ person, relation },
			);
		}
		case "counterpart_starts_after_end": {
			return t(
				"{person} only became {relation} {unit} after this end date, so that relation is left unchanged. Check whether it should be ended on a later date, or removed.",
				{ person, relation, unit },
			);
		}
		case "end_before_start": {
			return t("This end date falls before {person} became {relation}, so it cannot be saved.", {
				person,
				relation,
			});
		}
		case "counterpart_present": {
			return t("{person} is already {relation} {unit} for this period, so it will be left as is.", {
				person,
				relation,
				unit,
			});
		}
	}
}

function WizardWarningPeriods(
	props: Readonly<{ periods: NonNullable<WizardWarning["periods"]> }>,
): ReactNode {
	const { periods } = props;

	const t = useExtracted();

	return (
		<Fragment>
			{t("Affected period:")}{" "}
			{periods.map((period, index) => (
				<Fragment key={`${period.start}-${String(period.end)}`}>
					{index > 0 ? ", " : null}
					<WizardPeriod end={period.end} start={period.start} />
				</Fragment>
			))}
		</Fragment>
	);
}
