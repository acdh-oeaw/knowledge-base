"use client";

import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { AsyncSelect } from "@dariah-eric/ui/async-select";
import { ButtonLink } from "@dariah-eric/ui/button-link";
import { DatePicker, DatePickerTrigger } from "@dariah-eric/ui/date-picker";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import { Note } from "@dariah-eric/ui/note";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { TextField } from "@dariah-eric/ui/text-field";
import { TextArea } from "@dariah-eric/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@dariah-eric/ui/toggle-group";
import type { AsyncOption, AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
import type { CalendarDate } from "@internationalized/date";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useEffect, useState, useTransition } from "react";

import { DraftFormSubmitButtons } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/draft-form-submit-buttons";
import {
	FormSection,
	FormSectionTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { WizardReview } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_components/wizard-review";
import {
	WizardShell,
	WizardStepNav,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_components/wizard-shell";
import { WizardWarnings } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_components/wizard-warnings";
import { createPartnerInstitutionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/create-partner-institution.action";
import { partnerInstitutionPreflightAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/partner-institution-preflight.action";
import type { WizardPreflight } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-plan";
import type { PartnerInstitutionStatusType } from "@/lib/data/wizard-preflight";
import {
	type OrganisationalUnitOption,
	toOrganisationalUnitDocumentOptionsPage,
} from "@/lib/organisational-unit-options";

/**
 * Guided form for the case that motivated the whole feature: recording an institution's partnership
 * with DARIAH-EU. Doing it from the normal screens means creating the institution, then remembering
 * that it also needs an `is_located_in` relation to a country, then adding its status towards the
 * eric — and the middle step is the one that gets forgotten.
 *
 * Nothing is written until the review step is submitted; up to then the wizard only reads, so an
 * abandoned run leaves no trace.
 */

type InstitutionMode = "existing" | "new";

interface PartnerInstitutionWizardProps {
	statusTypes: ReadonlyArray<PartnerInstitutionStatusType>;
	ericName: string;
	initialInstitutionItems: Array<AsyncOption>;
	initialInstitutionTotal: number;
	initialCountryItems: Array<AsyncOption>;
	initialCountryTotal: number;
}

async function fetchUnitOptionsPage(
	unitType: "country" | "institution",
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		unitType,
		// Institutions created by a national coordinator sit in draft until an admin publishes them;
		// they must still be selectable here, or the wizard would push the admin into creating a
		// duplicate.
		includeDrafts: "true",
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

function formatStatusType(type: string): string {
	return type.replaceAll("_", " ");
}

export function PartnerInstitutionWizard(
	props: Readonly<PartnerInstitutionWizardProps>,
): ReactNode {
	const {
		statusTypes,
		ericName,
		initialInstitutionItems,
		initialInstitutionTotal,
		initialCountryItems,
		initialCountryTotal,
	} = props;

	const t = useExtracted();

	const [stepIndex, setStepIndex] = useState(0);

	const [mode, setMode] = useState<InstitutionMode>("new");
	const [institution, setInstitution] = useState<AsyncOption | null>(null);
	const [name, setName] = useState("");
	const [acronym, setAcronym] = useState("");
	const [ror, setRor] = useState("");
	const [summary, setSummary] = useState("");

	const [country, setCountry] = useState<AsyncOption | null>(null);
	const [locatedInStart, setLocatedInStart] = useState<CalendarDate | null>(null);

	const [statusType, setStatusType] = useState<PartnerInstitutionStatusType | null>(null);
	const [statusStart, setStatusStart] = useState<CalendarDate | null>(null);
	const [statusEnd, setStatusEnd] = useState<CalendarDate | null>(null);

	const [preflight, setPreflight] = useState<WizardPreflight | null>(null);
	const [isPreflightPending, startPreflightTransition] = useTransition();

	const [state, setState] = useState<ActionState>(() => createActionStateInitial());
	const [isSubmitPending, startSubmitTransition] = useTransition();

	const institutionName = mode === "existing" ? (institution?.name ?? "") : name.trim();
	const institutionDocumentId = mode === "existing" ? (institution?.id ?? null) : null;

	const isStepOneComplete = mode === "existing" ? institution != null : name.trim() !== "";
	const isStepTwoComplete = country != null && locatedInStart != null;
	const isStepThreeComplete = statusType != null && statusStart != null;

	const isReviewStep = stepIndex === 3;

	useEffect(() => {
		if (
			!isReviewStep ||
			country == null ||
			locatedInStart == null ||
			statusType == null ||
			statusStart == null
		) {
			return;
		}

		startPreflightTransition(async () => {
			const result = await partnerInstitutionPreflightAction({
				institutionDocumentId,
				institutionName,
				countryDocumentId: country.id,
				locatedInStart: locatedInStart.toString(),
				statusType,
				statusStart: statusStart.toString(),
				statusEnd: statusEnd?.toString() ?? null,
				lifecycle: "draft",
			});

			setPreflight(result);
		});
	}, [
		country,
		institutionDocumentId,
		institutionName,
		isReviewStep,
		locatedInStart,
		statusEnd,
		statusStart,
		statusType,
	]);

	function formAction(formData: FormData) {
		startSubmitTransition(async () => {
			setState(await createPartnerInstitutionAction(state, formData));
		});
	}

	const steps = [
		{ id: "institution", label: t("Institution") },
		{ id: "country", label: t("Country") },
		{ id: "status", label: t("Status towards {eric}", { eric: ericName }) },
		{ id: "review", label: t("Review") },
	];

	if (state.status === "success") {
		const createdSlug = (state.data as { institutionSlug?: string } | undefined)?.institutionSlug;

		return (
			<WizardShell
				currentStepIndex={steps.length}
				description={t("Everything has been saved.")}
				steps={steps}
				title={t("Record an institution's status towards {eric}", { eric: ericName })}
			>
				<Note intent="success">{state.message ?? t("Saved.")}</Note>
				<div className="flex flex-wrap gap-2">
					{createdSlug != null ? (
						<ButtonLink
							href={`/dashboard/administrator/institutions/${createdSlug}/edit`}
							intent="primary"
						>
							{t("Add the remaining details")}
						</ButtonLink>
					) : null}
					<ButtonLink href="/dashboard/administrator/guided-forms" intent="outline">
						{t("Back to guided forms")}
					</ButtonLink>
				</div>
			</WizardShell>
		);
	}

	return (
		<WizardShell
			currentStepIndex={stepIndex}
			description={t(
				"Records an institution as partner institution, national coordinating or representative institution, or cooperating partner of {eric}, together with the country it is located in, so the two can never be entered apart.",
				{ eric: ericName },
			)}
			steps={steps}
			title={t("Record an institution's status towards {eric}", { eric: ericName })}
		>
			{stepIndex === 0 ? (
				<Fragment>
					<FormSection
						description={t(
							"Pick an institution that already exists, or describe a new one. A new institution is created as a draft with these core fields; everything else can be added afterwards.",
						)}
						title={t("Institution")}
						variant="stacked"
					>
						<ToggleGroup
							aria-label={t("Institution")}
							onSelectionChange={(keys) => {
								const [key] = [...keys];
								if (key === "existing" || key === "new") {
									setMode(key);
								}
							}}
							selectedKeys={new Set([mode])}
							selectionMode="single"
						>
							<ToggleGroupItem id="new">{t("Create a new institution")}</ToggleGroupItem>
							<ToggleGroupItem id="existing">{t("Select an existing institution")}</ToggleGroupItem>
						</ToggleGroup>

						{mode === "existing" ? (
							<AsyncSelect
								aria-label={t("Institution")}
								emptyMessage={t("No institutions found.")}
								fetchPage={(params) => fetchUnitOptionsPage("institution", params)}
								initialItems={initialInstitutionItems}
								initialTotal={initialInstitutionTotal}
								isRequired={true}
								label={t("Institution")}
								loadOnMount={false}
								onSelect={setInstitution}
								placeholder={t("No institution selected")}
								selectedItem={institution}
							/>
						) : (
							<Fragment>
								<TextField isRequired={true} onChange={setName} value={name}>
									<Label>{t("Name")}</Label>
									<Input />
									<FieldError />
								</TextField>
								<TextField onChange={setAcronym} value={acronym}>
									<Label>{t("Acronym")}</Label>
									<Input />
									<FieldError />
								</TextField>
								<TextField onChange={setRor} value={ror}>
									<Label>{t("ROR")}</Label>
									<Input />
									<FieldError />
								</TextField>
								<TextField onChange={setSummary} value={summary}>
									<Label>{t("Summary")}</Label>
									<TextArea />
									<FieldError />
								</TextField>
							</Fragment>
						)}
					</FormSection>

					<WizardStepNav
						isNextDisabled={!isStepOneComplete}
						onNext={() => {
							setStepIndex(1);
						}}
					/>
				</Fragment>
			) : null}

			{stepIndex === 1 ? (
				<Fragment>
					<FormSection
						description={t(
							"Every institution that relates to DARIAH-EU must record which country it is located in. This is the step most often missed when the relations are entered separately.",
						)}
						title={t("Located in")}
						variant="stacked"
					>
						<AsyncSelect
							aria-label={t("Country")}
							emptyMessage={t("No countries found.")}
							fetchPage={(params) => fetchUnitOptionsPage("country", params)}
							initialItems={initialCountryItems}
							initialTotal={initialCountryTotal}
							isRequired={true}
							label={t("Country")}
							loadOnMount={false}
							onSelect={setCountry}
							placeholder={t("No country selected")}
							selectedItem={country}
						/>

						<DatePicker
							granularity="day"
							isRequired={true}
							onChange={setLocatedInStart}
							value={locatedInStart}
						>
							<Label>{t("Located there from")}</Label>
							<DatePickerTrigger />
							<FieldError />
						</DatePicker>
					</FormSection>

					<WizardStepNav
						isNextDisabled={!isStepTwoComplete}
						onBack={() => {
							setStepIndex(0);
						}}
						onNext={() => {
							setStepIndex(2);
						}}
					/>
				</Fragment>
			) : null}

			{stepIndex === 2 ? (
				<Fragment>
					<FormSection
						description={t(
							"How the institution relates to {eric}. Leave the end date empty while the relation is ongoing.",
							{ eric: ericName },
						)}
						title={t("Status towards {eric}", { eric: ericName })}
						variant="stacked"
					>
						<Select
							isRequired={true}
							onChange={(key) => {
								setStatusType(String(key) as PartnerInstitutionStatusType);
							}}
							value={statusType}
						>
							<Label>{t("Status")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{statusTypes.map((type) => (
									<SelectItem key={type} id={type}>
										{formatStatusType(type)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<DatePicker
							granularity="day"
							isRequired={true}
							onChange={setStatusStart}
							value={statusStart}
						>
							<Label>{t("From")}</Label>
							<DatePickerTrigger />
							<FieldError />
						</DatePicker>

						<DatePicker granularity="day" onChange={setStatusEnd} value={statusEnd}>
							<Label>{t("Until")}</Label>
							<DatePickerTrigger />
							<FieldError />
						</DatePicker>
					</FormSection>

					<WizardStepNav
						isNextDisabled={!isStepThreeComplete}
						onBack={() => {
							setStepIndex(1);
						}}
						onNext={() => {
							setStepIndex(3);
						}}
						nextLabel={t("Review")}
					/>
				</Fragment>
			) : null}

			{isReviewStep ? (
				<Form action={formAction} className="space-y-6" state={state}>
					<input name="name" type="hidden" value={institutionName} />
					{institutionDocumentId != null ? (
						<input name="institutionDocumentId" type="hidden" value={institutionDocumentId} />
					) : null}
					{mode === "new" ? (
						<Fragment>
							<input name="acronym" type="hidden" value={acronym.trim()} />
							<input name="ror" type="hidden" value={ror.trim()} />
							<input name="summary" type="hidden" value={summary.trim()} />
						</Fragment>
					) : null}
					<input name="countryDocumentId" type="hidden" value={country?.id ?? ""} />
					<input name="locatedInStart" type="hidden" value={locatedInStart?.toString() ?? ""} />
					<input name="statusType" type="hidden" value={statusType ?? ""} />
					<input name="statusStart" type="hidden" value={statusStart?.toString() ?? ""} />
					<input name="statusEnd" type="hidden" value={statusEnd?.toString() ?? ""} />

					{isPreflightPending || preflight == null ? (
						<div className="flex items-center gap-x-2 text-sm text-muted-fg">
							<ProgressCircle aria-label={t("Checking...")} isIndeterminate={true} />
							{t("Checking against the data-integrity rules...")}
						</div>
					) : (
						<Fragment>
							<WizardWarnings warnings={preflight.warnings} />
							<WizardReview items={preflight.items} />
						</Fragment>
					)}

					<FormSectionTitle title={t("Save")} />

					<div className="flex flex-wrap items-center gap-2">
						<DraftFormSubmitButtons
							isDisabled={isPreflightPending || preflight == null}
							isPending={isSubmitPending}
							publishLabel={t("Save and publish institution")}
							saveLabel={t("Save")}
							showSaveAndPublish={mode === "new"}
						/>
					</div>

					<FormStatus className="self-start" state={state} />

					<WizardStepNav
						onBack={() => {
							setStepIndex(2);
						}}
					/>
				</Form>
			) : null}
		</WizardShell>
	);
}
