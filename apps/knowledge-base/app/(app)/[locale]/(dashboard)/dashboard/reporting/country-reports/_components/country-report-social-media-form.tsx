"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import type {
	AvailableSocialMediaAccount,
	ReportSocialMediaAccount,
	SocialMediaKpiCategory,
} from "@/lib/data/report-social-media";
import type { ServerAction } from "@/lib/server/create-server-action";

/** Id linking the per-account KPI inputs (rendered inside account cards) to the single Save form. */
const KPI_FORM_ID = "country-report-social-media-kpis-form";

function formatKpi(kpi: string): string {
	return kpi.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

interface SocialMediaTypeOption {
	id: string;
	type: string;
}

interface CountryReportSocialMediaFormProps {
	reportId: string;
	accounts: Array<ReportSocialMediaAccount>;
	availableAccounts: Array<AvailableSocialMediaAccount>;
	socialMediaTypes: Array<SocialMediaTypeOption>;
	kpiCategories: ReadonlyArray<SocialMediaKpiCategory>;
	saveKpisAction: ServerAction;
	addAction: ServerAction;
	createAction: ServerAction;
	deleteAction: (formData: FormData) => Promise<void>;
}

export function CountryReportSocialMediaForm(
	props: Readonly<CountryReportSocialMediaFormProps>,
): ReactNode {
	const {
		reportId,
		accounts,
		availableAccounts,
		socialMediaTypes,
		kpiCategories,
		saveKpisAction,
		addAction,
		createAction,
		deleteAction,
	} = props;

	const t = useExtracted();
	const [saveState, saveAction, isSaving] = useActionState(
		saveKpisAction,
		createActionStateInitial(),
	);

	return (
		<div className="flex flex-col gap-y-10">
			<div className="flex flex-col gap-y-2">
				<h2 className="text-sm font-semibold text-fg">{t("Social media")}</h2>
				<p className="text-sm text-muted-fg max-inline-md">
					{t(
						"The social media accounts this report covers. Add the relevant metrics per account — you only need to fill in the numbers you have.",
					)}
				</p>
			</div>

			{accounts.length > 0 ? (
				<ul className="flex flex-col gap-y-4">
					{accounts.map((account) => (
						<li key={account.id}>
							<AccountCard
								account={account}
								deleteAction={deleteAction}
								kpiCategories={kpiCategories}
								reportId={reportId}
							/>
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-muted-fg">{t("No social media accounts added yet.")}</p>
			)}

			{accounts.length > 0 && (
				// The KPI inputs live inside the account cards above and link to this form via its `form` id
				// (so the card layout can keep its own per-account "Remove" form without nesting forms).
				<Form
					action={saveAction}
					className="flex flex-col gap-y-3"
					id={KPI_FORM_ID}
					state={saveState}
				>
					<input name="id" type="hidden" value={reportId} />
					<Button className="self-start" isPending={isSaving} type="submit">
						{isSaving ? (
							<Fragment>
								<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
								<span aria-hidden={true}>{t("Saving...")}</span>
							</Fragment>
						) : (
							t("Save metrics")
						)}
					</Button>
					<FormStatus className="self-start" state={saveState} />
				</Form>
			)}

			<div className="flex flex-col gap-y-6 border-bs border-border pbs-8">
				<AddExistingAccountForm
					addAction={addAction}
					availableAccounts={availableAccounts}
					reportId={reportId}
				/>
				<CreateAccountForm
					createAction={createAction}
					reportId={reportId}
					socialMediaTypes={socialMediaTypes}
				/>
			</div>
		</div>
	);
}

interface AccountCardProps {
	account: ReportSocialMediaAccount;
	reportId: string;
	kpiCategories: ReadonlyArray<SocialMediaKpiCategory>;
	deleteAction: (formData: FormData) => Promise<void>;
}

interface MetricRow {
	kpi: SocialMediaKpiCategory;
	value: string;
}

function AccountCard(props: Readonly<AccountCardProps>): ReactNode {
	const { account, reportId, kpiCategories, deleteAction } = props;

	const t = useExtracted();
	const [metrics, setMetrics] = useState<Array<MetricRow>>(() =>
		account.kpis.map((kpi) => {
			return { kpi: kpi.kpi, value: String(kpi.value) };
		}),
	);

	const used = new Set(metrics.map((metric) => metric.kpi));
	const remaining = kpiCategories.filter((category) => !used.has(category));

	function addMetric(kpi: SocialMediaKpiCategory): void {
		setMetrics((current) => [...current, { kpi, value: "" }]);
	}

	function removeMetric(kpi: SocialMediaKpiCategory): void {
		setMetrics((current) => current.filter((metric) => metric.kpi !== kpi));
	}

	function setValue(kpi: SocialMediaKpiCategory, value: string): void {
		setMetrics((current) =>
			current.map((metric) => (metric.kpi === kpi ? { ...metric, value } : metric)),
		);
	}

	return (
		<div className="flex flex-col gap-y-4 rounded-md border border-border p-4">
			<div className="flex items-start justify-between gap-x-4">
				<div className="flex flex-col gap-y-0.5">
					<p className="text-sm font-medium text-fg">{account.name}</p>
					<p className="text-xs text-muted-fg">{account.url}</p>
				</div>
				<form action={deleteAction}>
					<input name="membershipId" type="hidden" value={account.id} />
					<input name="countryReportId" type="hidden" value={reportId} />
					<Button
						className="text-danger hover:bg-danger/10 hover:text-danger"
						intent="plain"
						size="sm"
						type="submit"
					>
						{t("Remove")}
					</Button>
				</form>
			</div>

			{metrics.length > 0 && (
				<ul className="flex flex-col gap-y-2">
					{metrics.map((metric) => (
						<li key={metric.kpi} className="flex items-center gap-x-3">
							<label
								className="shrink-0 text-sm text-fg inline-40"
								htmlFor={`${account.id}-${metric.kpi}`}
							>
								{formatKpi(metric.kpi)}
							</label>
							<input
								className="rounded-md border border-border bg-bg px-2 py-1 text-sm text-fg inline-32"
								form={KPI_FORM_ID}
								id={`${account.id}-${metric.kpi}`}
								min={0}
								name={`kpis.${account.socialMediaId}.${metric.kpi}`}
								onChange={(event) => {
									setValue(metric.kpi, event.target.value);
								}}
								type="number"
								value={metric.value}
							/>
							<Button
								intent="plain"
								onPress={() => {
									removeMetric(metric.kpi);
								}}
								size="sm"
							>
								{t("Remove")}
							</Button>
						</li>
					))}
				</ul>
			)}

			{remaining.length > 0 && (
				<Select
					aria-label={t("Add metric")}
					onChange={(key) => {
						if (key != null) {
							addMetric(String(key) as SocialMediaKpiCategory);
						}
					}}
					placeholder={t("Add metric")}
					value={null}
				>
					<SelectTrigger className="max-inline-3xs" />
					<SelectContent>
						{remaining.map((category) => (
							<SelectItem key={category} id={category}>
								{formatKpi(category)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		</div>
	);
}

interface AddExistingAccountFormProps {
	reportId: string;
	availableAccounts: Array<AvailableSocialMediaAccount>;
	addAction: ServerAction;
}

function AddExistingAccountForm(props: Readonly<AddExistingAccountFormProps>): ReactNode {
	const { reportId, availableAccounts, addAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(addAction, createActionStateInitial());
	const [selectedId, setSelectedId] = useState<string>("");

	if (availableAccounts.length === 0) {
		return null;
	}

	return (
		<section className="flex flex-col gap-y-3">
			<h3 className="text-sm font-semibold text-fg">{t("Add an existing account")}</h3>
			<Form action={action} className="flex flex-col gap-y-4 max-inline-sm" state={state}>
				<input name="countryReportId" type="hidden" value={reportId} />

				<Select
					isRequired={true}
					onChange={(key) => {
						setSelectedId(String(key));
					}}
					value={selectedId || null}
				>
					<Label>{t("Account")}</Label>
					<SelectTrigger />
					<FieldError />
					<SelectContent>
						{availableAccounts.map((account) => (
							<SelectItem key={account.id} id={account.id}>
								{account.name}
								{` (${account.url})`}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<input name="socialMediaId" type="hidden" value={selectedId} />

				<Button className="self-start" isPending={isPending} type="submit">
					{isPending ? (
						<Fragment>
							<ProgressCircle aria-label={t("Adding...")} isIndeterminate={true} />
							<span aria-hidden={true}>{t("Adding...")}</span>
						</Fragment>
					) : (
						t("Add")
					)}
				</Button>

				<FormStatus className="self-start" state={state} />
			</Form>
		</section>
	);
}

interface CreateAccountFormProps {
	reportId: string;
	socialMediaTypes: Array<SocialMediaTypeOption>;
	createAction: ServerAction;
}

function CreateAccountForm(props: Readonly<CreateAccountFormProps>): ReactNode {
	const { reportId, socialMediaTypes, createAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(createAction, createActionStateInitial());
	const [typeId, setTypeId] = useState<string>("");

	return (
		<section className="flex flex-col gap-y-3">
			<h3 className="text-sm font-semibold text-fg">{t("Create a new account")}</h3>
			<p className="text-sm text-muted-fg max-inline-md">
				{t("For an account not yet in the system, e.g. a website set up for a specific event.")}
			</p>
			<Form action={action} className="flex flex-col gap-y-4 max-inline-sm" state={state}>
				<input name="countryReportId" type="hidden" value={reportId} />

				<TextField isRequired={true} name="name">
					<Label>{t("Name")}</Label>
					<Input />
					<FieldError />
				</TextField>

				<TextField isRequired={true} name="url" type="url">
					<Label>{t("URL")}</Label>
					<Input />
					<FieldError />
				</TextField>

				<Select
					isRequired={true}
					onChange={(key) => {
						setTypeId(String(key));
					}}
					value={typeId || null}
				>
					<Label>{t("Type")}</Label>
					<SelectTrigger />
					<FieldError />
					<SelectContent>
						{socialMediaTypes.map((type) => (
							<SelectItem key={type.id} id={type.id}>
								{formatKpi(type.type)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<input name="typeId" type="hidden" value={typeId} />

				<Button className="self-start" isPending={isPending} type="submit">
					{isPending ? (
						<Fragment>
							<ProgressCircle aria-label={t("Adding...")} isIndeterminate={true} />
							<span aria-hidden={true}>{t("Adding...")}</span>
						</Fragment>
					) : (
						t("Create and add")
					)}
				</Button>

				<FormStatus className="self-start" state={state} />
			</Form>
		</section>
	);
}
