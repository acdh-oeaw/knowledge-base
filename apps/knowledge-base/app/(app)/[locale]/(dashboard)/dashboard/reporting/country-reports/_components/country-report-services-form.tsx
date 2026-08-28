"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import type {
	AvailableReportService,
	ReportServiceWithKpis,
	ServiceKpiCategory,
} from "@/lib/data/report-services";
import type { ServerAction } from "@/lib/server/create-server-action";

/** Id linking the per-service KPI inputs (rendered inside service cards) to the single Save form. */
const KPI_FORM_ID = "country-report-service-kpis-form";

function formatKpi(kpi: string): string {
	return kpi.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

interface CountryReportServicesFormProps {
	reportId: string;
	services: Array<ReportServiceWithKpis>;
	availableServices: Array<AvailableReportService>;
	kpiCategories: ReadonlyArray<ServiceKpiCategory>;
	saveKpisAction: ServerAction;
	addAction: ServerAction;
	deleteAction: (formData: FormData) => Promise<void>;
}

export function CountryReportServicesForm(
	props: Readonly<CountryReportServicesFormProps>,
): ReactNode {
	const {
		reportId,
		services,
		availableServices,
		kpiCategories,
		saveKpisAction,
		addAction,
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
				<h2 className="text-sm font-semibold text-fg">{t("Services")}</h2>
				<p className="text-sm text-muted-fg max-inline-md">
					{t(
						"The services this report covers. Add the relevant metrics per service — you only need to fill in the numbers you have.",
					)}
				</p>
			</div>

			{services.length > 0 ? (
				<ul className="flex flex-col gap-y-4">
					{services.map((service) => (
						<li key={service.membershipId}>
							<ServiceCard
								deleteAction={deleteAction}
								kpiCategories={kpiCategories}
								reportId={reportId}
								service={service}
							/>
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-muted-fg">{t("No services added yet.")}</p>
			)}

			{services.length > 0 && (
				// The KPI inputs live inside the service cards and link to this form by id, avoiding
				// nested forms around each card's remove action.
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
				<AddExistingServiceForm
					addAction={addAction}
					availableServices={availableServices}
					reportId={reportId}
				/>
			</div>
		</div>
	);
}

interface ServiceCardProps {
	service: ReportServiceWithKpis;
	reportId: string;
	kpiCategories: ReadonlyArray<ServiceKpiCategory>;
	deleteAction: (formData: FormData) => Promise<void>;
}

interface MetricRow {
	kpi: ServiceKpiCategory;
	value: string;
}

function ServiceCard(props: Readonly<ServiceCardProps>): ReactNode {
	const { service, reportId, kpiCategories, deleteAction } = props;

	const t = useExtracted();
	const [metrics, setMetrics] = useState<Array<MetricRow>>(() =>
		service.kpis.map((kpi) => {
			return { kpi: kpi.kpi, value: String(kpi.value) };
		}),
	);

	const used = new Set(metrics.map((metric) => metric.kpi));
	const remaining = kpiCategories.filter((category) => !used.has(category));

	function addMetric(kpi: ServiceKpiCategory): void {
		setMetrics((current) => [...current, { kpi, value: "" }]);
	}

	function removeMetric(kpi: ServiceKpiCategory): void {
		setMetrics((current) => current.filter((metric) => metric.kpi !== kpi));
	}

	function setValue(kpi: ServiceKpiCategory, value: string): void {
		setMetrics((current) =>
			current.map((metric) => (metric.kpi === kpi ? { ...metric, value } : metric)),
		);
	}

	return (
		<div className="flex flex-col gap-y-4 rounded-md border border-border p-4">
			<div className="flex items-start justify-between gap-x-4">
				<p className="text-sm font-medium text-fg">{service.name}</p>
				<form action={deleteAction}>
					<input name="membershipId" type="hidden" value={service.membershipId} />
					<input name="countryReportId" type="hidden" value={reportId} />
					<Button
						className="text-danger hover:bg-danger/10 hover:text-danger"
						intent="plain"
						size="sm"
						type="submit"
					>
						{t("Remove service")}
					</Button>
				</form>
			</div>

			{metrics.length > 0 && (
				<ul className="flex flex-col gap-y-2">
					{metrics.map((metric) => (
						<li key={metric.kpi} className="flex items-center gap-x-3">
							<label
								className="shrink-0 text-sm text-fg inline-40"
								htmlFor={`${service.id}-${metric.kpi}`}
							>
								{formatKpi(metric.kpi)}
							</label>
							<input
								className="rounded-md border border-border bg-bg px-2 py-1 text-sm text-fg inline-32"
								form={KPI_FORM_ID}
								id={`${service.id}-${metric.kpi}`}
								min={0}
								name={`kpis.${service.id}.${metric.kpi}`}
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
							addMetric(String(key) as ServiceKpiCategory);
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

interface AddExistingServiceFormProps {
	reportId: string;
	availableServices: Array<AvailableReportService>;
	addAction: ServerAction;
}

function AddExistingServiceForm(props: Readonly<AddExistingServiceFormProps>): ReactNode {
	const { reportId, availableServices, addAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(addAction, createActionStateInitial());
	const [selectedId, setSelectedId] = useState<string>("");

	if (availableServices.length === 0) {
		return null;
	}

	return (
		<section className="flex flex-col gap-y-3">
			<h3 className="text-sm font-semibold text-fg">{t("Add an existing service")}</h3>
			<Form action={action} className="flex flex-col gap-y-4 max-inline-sm" state={state}>
				<input name="countryReportId" type="hidden" value={reportId} />

				<Select
					isRequired={true}
					onChange={(key) => {
						setSelectedId(String(key));
					}}
					value={selectedId || null}
				>
					<Label>{t("Service")}</Label>
					<SelectTrigger />
					<FieldError />
					<SelectContent>
						{availableServices.map((service) => (
							<SelectItem key={service.id} id={service.id}>
								{service.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<input name="serviceId" type="hidden" value={selectedId} />

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
