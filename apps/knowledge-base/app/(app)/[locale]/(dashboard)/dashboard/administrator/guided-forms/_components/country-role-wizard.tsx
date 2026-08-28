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
import { SubmitButton } from "@dariah-eric/ui/submit-button";
import { TextField } from "@dariah-eric/ui/text-field";
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
import {
	countryRolePreflightAction,
	endCountryRolePreflightAction,
	openCountryRoleAppointmentsAction,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/country-role-preflight.action";
import { createCountryRoleAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/create-country-role.action";
import { endCountryRoleAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/end-country-role.action";
import type { WizardPreflight } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-plan";
import type { CountryRoleType } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-registry";
import type {
	CountryRoleAppointment,
	CountryRoleCounterpartOption,
	EndCountryRolePreflight,
	PersonRoleType,
} from "@/lib/data/wizard-preflight";
import {
	type OrganisationalUnitOption,
	toOrganisationalUnitDocumentOptionsPage,
} from "@/lib/organisational-unit-options";

/**
 * Guided form for appointing a national coordinator, national representative, or deputy.
 *
 * The appointment is two facts, not one: the role in the country, and the seat on the National
 * Coordinator Committee or the General Assembly that comes with it. `pairedRelationRules` says they
 * must exist together _and_ over the same period, so this form collects one duration and applies it
 * to both — the mismatch it prevents is otherwise only noticed by the maintenance dashboard.
 */

type PersonMode = "existing" | "new";

/** Appointing someone, or ending an appointment — the two halves of the same paired rule. */
type WizardMode = "end" | "start";

interface CountryRoleWizardProps {
	roleTypes: ReadonlyArray<CountryRoleType>;
	counterpartRoleOptions: Record<CountryRoleType, CountryRoleCounterpartOption>;
	initialPersonItems: Array<AsyncOption>;
	initialPersonTotal: number;
	initialCountryItems: Array<AsyncOption>;
	initialCountryTotal: number;
}

async function fetchPersonOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		resource: "persons",
		includeDrafts: "true",
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/contributions/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load persons.");
	}

	return (await response.json()) as { items: Array<AsyncOption>; total: number };
}

async function fetchCountryOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		unitType: "country",
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/organisational-units/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load countries.");
	}

	return toOrganisationalUnitDocumentOptionsPage(
		(await response.json()) as { items: Array<OrganisationalUnitOption>; total: number },
	);
}

function formatRoleType(type: string): string {
	return type.replaceAll("_", " ");
}

export function CountryRoleWizard(props: Readonly<CountryRoleWizardProps>): ReactNode {
	const {
		roleTypes,
		counterpartRoleOptions,
		initialPersonItems,
		initialPersonTotal,
		initialCountryItems,
		initialCountryTotal,
	} = props;

	const t = useExtracted();

	const [stepIndex, setStepIndex] = useState(0);
	const [wizardMode, setWizardMode] = useState<WizardMode>("start");

	const [mode, setMode] = useState<PersonMode>("existing");
	const [person, setPerson] = useState<AsyncOption | null>(null);
	const [name, setName] = useState("");
	const [sortName, setSortName] = useState("");
	const [email, setEmail] = useState("");
	const [orcid, setOrcid] = useState("");

	const [country, setCountry] = useState<AsyncOption | null>(null);
	const [roleType, setRoleType] = useState<CountryRoleType | null>(null);
	const [counterpartRoleType, setCounterpartRoleType] = useState<PersonRoleType | null>(null);
	const [start, setStart] = useState<CalendarDate | null>(null);
	const [end, setEnd] = useState<CalendarDate | null>(null);

	const counterpartRole = roleType == null ? null : counterpartRoleOptions[roleType];
	const counterpartRoleChoices = counterpartRole?.options ?? [];
	// The server applies the same default, so the select can show the effective value from the start
	// rather than an empty field the admin has to fill in to get the obvious answer.
	const effectiveCounterpartRoleType =
		counterpartRoleType ?? counterpartRole?.defaultRoleType ?? null;

	const [appointments, setAppointments] = useState<Array<CountryRoleAppointment> | null>(null);
	const [appointmentId, setAppointmentId] = useState<string | null>(null);
	const [endDate, setEndDate] = useState<CalendarDate | null>(null);
	const [endPreflight, setEndPreflight] = useState<EndCountryRolePreflight | null>(null);

	const [preflight, setPreflight] = useState<WizardPreflight | null>(null);
	const [isPreflightPending, startPreflightTransition] = useTransition();

	const [state, setState] = useState<ActionState>(() => createActionStateInitial());
	const [isSubmitPending, startSubmitTransition] = useTransition();

	const personName = mode === "existing" ? (person?.name ?? "") : name.trim();
	const personDocumentId = mode === "existing" ? (person?.id ?? null) : null;

	const isEndMode = wizardMode === "end";

	const isStepOneComplete =
		// Ending an appointment always starts from someone who already has one.
		isEndMode || mode === "existing"
			? person != null
			: name.trim() !== "" && sortName.trim() !== "";
	const isStepTwoComplete = isEndMode
		? appointmentId != null && endDate != null
		: country != null && roleType != null && start != null;

	const isReviewStep = stepIndex === 2;

	// The open appointments to choose from are only known once a person is picked.
	useEffect(() => {
		if (!isEndMode || person == null) {
			setAppointments(null);
			return;
		}

		startPreflightTransition(async () => {
			const result = await openCountryRoleAppointmentsAction(person.id);
			setAppointments(result);
			setAppointmentId(result.length === 1 ? (result[0]?.id ?? null) : null);
		});
	}, [isEndMode, person]);

	useEffect(() => {
		if (!isReviewStep || !isEndMode || appointmentId == null || endDate == null) {
			return;
		}

		startPreflightTransition(async () => {
			const result = await endCountryRolePreflightAction({
				appointmentId,
				end: endDate.toString(),
			});

			setEndPreflight(result);
		});
	}, [appointmentId, endDate, isEndMode, isReviewStep]);

	useEffect(() => {
		if (isEndMode || !isReviewStep || country == null || roleType == null || start == null) {
			return;
		}

		startPreflightTransition(async () => {
			const result = await countryRolePreflightAction({
				personDocumentId,
				personName,
				countryDocumentId: country.id,
				roleType,
				counterpartRoleType: effectiveCounterpartRoleType,
				start: start.toString(),
				end: end?.toString() ?? null,
				lifecycle: "draft",
			});

			setPreflight(result);
		});
	}, [
		country,
		effectiveCounterpartRoleType,
		end,
		isEndMode,
		isReviewStep,
		personDocumentId,
		personName,
		roleType,
		start,
	]);

	function formAction(formData: FormData) {
		startSubmitTransition(async () => {
			setState(await createCountryRoleAction(state, formData));
		});
	}

	function endFormAction(formData: FormData) {
		startSubmitTransition(async () => {
			setState(await endCountryRoleAction(state, formData));
		});
	}

	const steps = [
		{ id: "person", label: t("Person") },
		{ id: "appointment", label: isEndMode ? t("Appointment to end") : t("Appointment") },
		{ id: "review", label: t("Review") },
	];

	if (state.status === "success") {
		const createdSlug = (state.data as { personSlug?: string } | undefined)?.personSlug;

		return (
			<WizardShell
				currentStepIndex={steps.length}
				description={t("Everything has been saved.")}
				steps={steps}
				title={t("Start or end a national coordinator or representative appointment")}
			>
				<Note intent="success">{state.message ?? t("Saved.")}</Note>
				<div className="flex flex-wrap gap-2">
					{createdSlug != null ? (
						<ButtonLink
							href={`/dashboard/administrator/persons/${createdSlug}/edit`}
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
				"Records a person's appointment as national coordinator or representative (or deputy), or ends it, together with the governance-body seat that comes with it, over one and the same period.",
			)}
			steps={steps}
			title={t("Start or end a national coordinator or representative appointment")}
		>
			{stepIndex === 0 ? (
				<Fragment>
					<FormSection
						description={t(
							"An appointment and the governance-body seat that comes with it are recorded — and ended — together.",
						)}
						title={t("What are you doing?")}
						variant="stacked"
					>
						<ToggleGroup
							aria-label={t("What are you doing?")}
							onSelectionChange={(keys) => {
								const [key] = [...keys];
								if (key === "start" || key === "end") {
									setWizardMode(key);
									// Ending starts from an existing appointment, so a half-filled new person
									// from the other mode would only be in the way.
									setMode("existing");
									setAppointmentId(null);
									setEndDate(null);
								}
							}}
							selectedKeys={new Set([wizardMode])}
							selectionMode="single"
						>
							<ToggleGroupItem id="start">{t("Start an appointment")}</ToggleGroupItem>
							<ToggleGroupItem id="end">{t("End an appointment")}</ToggleGroupItem>
						</ToggleGroup>
					</FormSection>

					<FormSection
						description={
							isEndMode
								? t("Pick the person whose appointment is ending.")
								: t(
										"Pick the person being appointed, or add a new one. A new person is created as a draft with these core fields.",
									)
						}
						title={t("Person")}
						variant="stacked"
					>
						{isEndMode ? null : (
							<ToggleGroup
								aria-label={t("Person")}
								onSelectionChange={(keys) => {
									const [key] = [...keys];
									if (key === "existing" || key === "new") {
										setMode(key);
									}
								}}
								selectedKeys={new Set([mode])}
								selectionMode="single"
							>
								<ToggleGroupItem id="existing">{t("Select an existing person")}</ToggleGroupItem>
								<ToggleGroupItem id="new">{t("Create a new person")}</ToggleGroupItem>
							</ToggleGroup>
						)}

						{isEndMode || mode === "existing" ? (
							<AsyncSelect
								aria-label={t("Person")}
								emptyMessage={t("No persons found.")}
								fetchPage={fetchPersonOptionsPage}
								initialItems={initialPersonItems}
								initialTotal={initialPersonTotal}
								isRequired={true}
								label={t("Person")}
								loadOnMount={false}
								onSelect={setPerson}
								placeholder={t("No person selected")}
								selectedItem={person}
							/>
						) : (
							<Fragment>
								<TextField
									isRequired={true}
									onChange={(value) => {
										setName(value);
										// The sort name is almost always "Family, Given"; pre-filling with the name
										// keeps it a one-field edit rather than a second thing to remember.
										if (sortName === "") {
											setSortName(value);
										}
									}}
									value={name}
								>
									<Label>{t("Name")}</Label>
									<Input />
									<FieldError />
								</TextField>
								<TextField isRequired={true} onChange={setSortName} value={sortName}>
									<Label>{t("Sort name")}</Label>
									<Input />
									<FieldError />
								</TextField>
								<TextField onChange={setEmail} type="email" value={email}>
									<Label>{t("Email")}</Label>
									<Input />
									<FieldError />
								</TextField>
								<TextField onChange={setOrcid} value={orcid}>
									<Label>{t("ORCID")}</Label>
									<Input />
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

			{stepIndex === 1 && isEndMode ? (
				<Fragment>
					<FormSection
						description={t(
							"Which appointment is ending, and when. The governance-body membership it pairs with is closed on the same date, and is shown on the next step.",
						)}
						title={t("Appointment to end")}
						variant="stacked"
					>
						{appointments == null ? (
							<div className="flex items-center gap-x-2 text-sm text-muted-fg">
								<ProgressCircle aria-label={t("Loading...")} isIndeterminate={true} />
								{t("Loading appointments...")}
							</div>
						) : appointments.length === 0 ? (
							<Note intent="info">
								{t("{person} holds no open country role, so there is nothing to end.", {
									person: personName,
								})}
							</Note>
						) : (
							<Select
								isRequired={true}
								onChange={(key) => {
									setAppointmentId(String(key));
								}}
								value={appointmentId}
							>
								<Label>{t("Appointment")}</Label>
								<SelectTrigger />
								<FieldError />
								<SelectContent>
									{appointments.map((appointment) => (
										<SelectItem key={appointment.id} id={appointment.id}>
											{`${formatRoleType(appointment.roleType)} · ${appointment.countryName}`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}

						<DatePicker granularity="day" isRequired={true} onChange={setEndDate} value={endDate}>
							<Label>{t("End date")}</Label>
							<DatePickerTrigger />
							<FieldError />
						</DatePicker>
					</FormSection>

					<WizardStepNav
						isNextDisabled={!isStepTwoComplete}
						nextLabel={t("Review")}
						onBack={() => {
							setStepIndex(0);
						}}
						onNext={() => {
							setStepIndex(2);
						}}
					/>
				</Fragment>
			) : null}

			{stepIndex === 1 && !isEndMode ? (
				<Fragment>
					<FormSection
						description={t(
							"The role and the country it applies to. The matching governance-body membership is derived from the role and shown on the next step.",
						)}
						title={t("Appointment")}
						variant="stacked"
					>
						<AsyncSelect
							aria-label={t("Country")}
							emptyMessage={t("No countries found.")}
							fetchPage={fetchCountryOptionsPage}
							initialItems={initialCountryItems}
							initialTotal={initialCountryTotal}
							isRequired={true}
							label={t("Country")}
							loadOnMount={false}
							onSelect={setCountry}
							placeholder={t("No country selected")}
							selectedItem={country}
						/>

						<Select
							isRequired={true}
							onChange={(key) => {
								setRoleType(String(key) as CountryRoleType);
								setCounterpartRoleType(null);
							}}
							value={roleType}
						>
							<Label>{t("Role")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{roleTypes.map((type) => (
									<SelectItem key={type} id={type}>
										{formatRoleType(type)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{/*
						 * Only shown where the paired rule accepts more than one role: chairing or
						 * vice-chairing the National Coordinator Committee counts as being on it, whereas
						 * the General Assembly rule is satisfied by membership alone and offers no choice.
						 */}
						{counterpartRoleChoices.length > 1 ? (
							<Select
								onChange={(key) => {
									setCounterpartRoleType(String(key) as PersonRoleType);
								}}
								value={effectiveCounterpartRoleType}
							>
								<Label>{t("Role on the governance body")}</Label>
								<SelectTrigger />
								<FieldError />
								<SelectContent>
									{counterpartRoleChoices.map((type) => (
										<SelectItem key={type} id={type}>
											{formatRoleType(type)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : null}

						<DatePicker granularity="day" isRequired={true} onChange={setStart} value={start}>
							<Label>{t("From")}</Label>
							<DatePickerTrigger />
							<FieldError />
						</DatePicker>

						<DatePicker granularity="day" onChange={setEnd} value={end}>
							<Label>{t("Until")}</Label>
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
						nextLabel={t("Review")}
					/>
				</Fragment>
			) : null}

			{isReviewStep && isEndMode ? (
				<Form action={endFormAction} className="space-y-6" state={state}>
					<input name="appointmentId" type="hidden" value={appointmentId ?? ""} />
					<input name="end" type="hidden" value={endDate?.toString() ?? ""} />

					{isPreflightPending || endPreflight == null ? (
						<div className="flex items-center gap-x-2 text-sm text-muted-fg">
							<ProgressCircle aria-label={t("Checking...")} isIndeterminate={true} />
							{t("Checking against the data-integrity rules...")}
						</div>
					) : (
						<Fragment>
							<WizardWarnings warnings={endPreflight.warnings} />
							<WizardReview items={endPreflight.items} />
						</Fragment>
					)}

					<div className="flex flex-wrap items-center gap-2">
						<SubmitButton
							isDisabled={
								isPreflightPending ||
								endPreflight == null ||
								// The database rejects an inverted period outright, so block the submit rather
								// than let it fail; the warning above explains why.
								endPreflight.warnings.some((warning) => warning.code === "end_before_start")
							}
						>
							{isSubmitPending
								? t("Saving...")
								: endPreflight?.counterpartRelationId != null
									? t("End both relations")
									: t("End the appointment")}
						</SubmitButton>
					</div>

					<FormStatus className="self-start" state={state} />

					<WizardStepNav
						onBack={() => {
							setStepIndex(1);
						}}
					/>
				</Form>
			) : null}

			{isReviewStep && !isEndMode ? (
				<Form action={formAction} className="space-y-6" state={state}>
					<input name="name" type="hidden" value={personName} />
					{personDocumentId != null ? (
						<input name="personDocumentId" type="hidden" value={personDocumentId} />
					) : null}
					{mode === "new" ? (
						<Fragment>
							<input name="sortName" type="hidden" value={sortName.trim()} />
							<input name="email" type="hidden" value={email.trim()} />
							<input name="orcid" type="hidden" value={orcid.trim()} />
						</Fragment>
					) : (
						// `sortName` is required by the schema even when an existing person is picked, where
						// it is never used; mirror the name so validation reflects the real requirement.
						<input name="sortName" type="hidden" value={personName} />
					)}
					<input name="countryDocumentId" type="hidden" value={country?.id ?? ""} />
					<input name="roleType" type="hidden" value={roleType ?? ""} />
					<input
						name="counterpartRoleType"
						type="hidden"
						value={effectiveCounterpartRoleType ?? ""}
					/>
					<input name="start" type="hidden" value={start?.toString() ?? ""} />
					<input name="end" type="hidden" value={end?.toString() ?? ""} />

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
							publishLabel={t("Save and publish person")}
							saveLabel={t("Save")}
							showSaveAndPublish={mode === "new"}
						/>
					</div>

					<FormStatus className="self-start" state={state} />

					<WizardStepNav
						onBack={() => {
							setStepIndex(1);
						}}
					/>
				</Form>
			) : null}
		</WizardShell>
	);
}
