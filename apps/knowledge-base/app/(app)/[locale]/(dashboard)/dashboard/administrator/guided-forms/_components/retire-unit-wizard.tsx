"use client";

import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { AsyncSelect } from "@dariah-eric/ui/async-select";
import { ButtonLink } from "@dariah-eric/ui/button-link";
import { Checkbox } from "@dariah-eric/ui/checkbox";
import { DatePicker, DatePickerTrigger } from "@dariah-eric/ui/date-picker";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Note } from "@dariah-eric/ui/note";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { SubmitButton } from "@dariah-eric/ui/submit-button";
import type { AsyncOption, AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
import type { CalendarDate } from "@internationalized/date";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useEffect, useState, useTransition } from "react";

import {
	FormSection,
	FormSectionTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { WizardReview } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_components/wizard-review";
import {
	WizardShell,
	WizardStepNav,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_components/wizard-shell";
import { retireUnitPreflightAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/retire-unit-preflight.action";
import { retireUnitAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/retire-unit.action";
import type { RetireUnitPreflight } from "@/lib/data/wizard-preflight";
import {
	type OrganisationalUnitOption,
	toOrganisationalUnitDocumentOptionsPage,
} from "@/lib/organisational-unit-options";

/**
 * Guided form for ending a working group or a country's membership.
 *
 * `inactiveUnitRelationRules` flags a unit whose own membership has ended while its chairs,
 * members, coordinators, or contacts are still recorded as current — the state you get when the
 * unit is closed on one screen and everyone attached to it is forgotten. This form lists all of it
 * in one place and ends it on one date, while still letting a relation that genuinely outlives the
 * unit be unchecked.
 */

interface RetireUnitWizardProps {
	unitTypes: ReadonlyArray<string>;
	initialUnitItems: Array<AsyncOption>;
	initialUnitTotal: number;
}

async function fetchUnitOptionsPage(
	unitType: string,
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		unitType,
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/organisational-units/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load organisational units.");
	}

	return toOrganisationalUnitDocumentOptionsPage(
		(await response.json()) as { items: Array<OrganisationalUnitOption>; total: number },
	);
}

function formatType(type: string): string {
	return type.replaceAll("_", " ");
}

export function RetireUnitWizard(props: Readonly<RetireUnitWizardProps>): ReactNode {
	const { unitTypes, initialUnitItems, initialUnitTotal } = props;

	const t = useExtracted();

	const [stepIndex, setStepIndex] = useState(0);
	const [unitType, setUnitType] = useState<string>(unitTypes[0] ?? "working_group");
	const [unit, setUnit] = useState<AsyncOption | null>(null);
	const [end, setEnd] = useState<CalendarDate | null>(null);
	const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());

	const [preflight, setPreflight] = useState<RetireUnitPreflight | null>(null);
	const [isPreflightPending, startPreflightTransition] = useTransition();

	const [state, setState] = useState<ActionState>(() => createActionStateInitial());
	const [isSubmitPending, startSubmitTransition] = useTransition();

	const isStepOneComplete = unit != null && end != null;
	const isReviewStep = stepIndex === 1;

	useEffect(() => {
		if (!isReviewStep || unit == null || end == null) {
			return;
		}

		startPreflightTransition(async () => {
			const result = await retireUnitPreflightAction({
				unitDocumentId: unit.id,
				end: end.toString(),
			});

			setPreflight(result);
			setExcluded(new Set());
		});
	}, [end, isReviewStep, unit]);

	function formAction(formData: FormData) {
		startSubmitTransition(async () => {
			setState(await retireUnitAction(state, formData));
		});
	}

	const steps = [
		{ id: "unit", label: t("Working group or country") },
		{ id: "review", label: t("Review") },
	];

	const selected = (preflight?.relations ?? []).filter((relation) => !excluded.has(relation.key));
	const selectedItems = (preflight?.items ?? []).filter((item) => !excluded.has(item.id));

	if (state.status === "success") {
		return (
			<WizardShell
				currentStepIndex={steps.length}
				description={t("Everything has been saved.")}
				steps={steps}
				title={t("End a working group or a country's membership")}
			>
				<Note intent="success">{state.message ?? t("Saved.")}</Note>
				<ButtonLink href="/dashboard/administrator/guided-forms" intent="outline">
					{t("Back to guided forms")}
				</ButtonLink>
			</WizardShell>
		);
	}

	return (
		<WizardShell
			currentStepIndex={stepIndex}
			description={t(
				"Ends the working group's or country's own membership, and every chair, member, coordinator, or contact still recorded in it, all on the same date.",
			)}
			steps={steps}
			title={t("End a working group or a country's membership")}
		>
			{stepIndex === 0 ? (
				<Fragment>
					<FormSection
						description={t(
							"Pick the working group or country and the date its membership ends. The next step lists everything that will be closed.",
						)}
						title={t("Working group or country")}
						variant="stacked"
					>
						<Select
							isRequired={true}
							onChange={(key) => {
								setUnitType(String(key));
								setUnit(null);
							}}
							value={unitType}
						>
							<Label>{t("Type")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{unitTypes.map((type) => (
									<SelectItem key={type} id={type}>
										{formatType(type)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<AsyncSelect
							aria-label={t("Working group or country")}
							cacheKey={unitType}
							emptyMessage={t("No working groups or countries found.")}
							fetchPage={(params) => fetchUnitOptionsPage(unitType, params)}
							initialItems={initialUnitItems}
							initialTotal={initialUnitTotal}
							isRequired={true}
							label={t("Working group or country")}
							loadOnMount={true}
							onSelect={setUnit}
							placeholder={t("No working group or country selected")}
							selectedItem={unit}
						/>

						<DatePicker granularity="day" isRequired={true} onChange={setEnd} value={end}>
							<Label>{t("End date")}</Label>
							<DatePickerTrigger />
							<FieldError />
						</DatePicker>
					</FormSection>

					<WizardStepNav
						isNextDisabled={!isStepOneComplete}
						nextLabel={t("Review")}
						onNext={() => {
							setStepIndex(1);
						}}
					/>
				</Fragment>
			) : null}

			{isReviewStep ? (
				<Form action={formAction} className="space-y-6" state={state}>
					<input name="unitDocumentId" type="hidden" value={unit?.id ?? ""} />
					<input name="end" type="hidden" value={end?.toString() ?? ""} />

					{selected
						.filter((relation) => relation.kind === "unit_relation")
						.map((relation, index) => (
							<input
								key={relation.key}
								name={`unitRelationIds.${String(index)}`}
								type="hidden"
								value={relation.rowId}
							/>
						))}

					{selected
						.filter((relation) => relation.kind === "person_relation")
						.map((relation, index) => (
							<input
								key={relation.key}
								name={`personRelationIds.${String(index)}`}
								type="hidden"
								value={relation.rowId}
							/>
						))}

					{isPreflightPending || preflight == null ? (
						<div className="flex items-center gap-x-2 text-sm text-muted-fg">
							<ProgressCircle aria-label={t("Checking...")} isIndeterminate={true} />
							{t("Checking against the data-integrity rules...")}
						</div>
					) : preflight.relations.length === 0 ? (
						<Note intent="info">
							{t(
								"Nothing is still open on this working group or country, so there is nothing to end.",
							)}
						</Note>
					) : (
						<Fragment>
							<FormSectionTitle title={t("Relations to end")} />
							<ul className="space-y-2">
								{preflight.relations.map((relation) => (
									<li key={relation.key}>
										<Checkbox
											isSelected={!excluded.has(relation.key)}
											onChange={(isSelected) => {
												setExcluded((previous) => {
													const next = new Set(previous);
													if (isSelected) {
														next.delete(relation.key);
													} else {
														next.add(relation.key);
													}
													return next;
												});
											}}
										>
											{`${formatType(relation.relationType)} · ${relation.counterpartName}`}
										</Checkbox>
									</li>
								))}
							</ul>

							<WizardReview items={selectedItems} />
						</Fragment>
					)}

					<div className="flex flex-wrap items-center gap-2">
						<SubmitButton
							isDisabled={isPreflightPending || preflight == null || selected.length === 0}
						>
							{isSubmitPending ? t("Saving...") : t("End the selected relations")}
						</SubmitButton>
					</div>

					<FormStatus className="self-start" state={state} />

					<WizardStepNav
						onBack={() => {
							setStepIndex(0);
						}}
					/>
				</Form>
			) : null}
		</WizardShell>
	);
}
