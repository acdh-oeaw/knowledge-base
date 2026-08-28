"use client";

import type * as schema from "@dariah-eric/database/schema";
import { reportStatusEnum } from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { updateCountryReportAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/country-reports/_lib/update-country-report.action";

interface CountryReportEditFormProps {
	report: Pick<schema.CountryReport, "id" | "status"> & {
		campaign: Pick<schema.ReportingCampaign, "year">;
		country: Pick<schema.OrganisationalUnit, "name">;
	};
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

export function CountryReportEditForm(props: Readonly<CountryReportEditFormProps>): ReactNode {
	const { report } = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(
		updateCountryReportAction,
		createActionStateInitial(),
	);

	const [selectedStatus, setSelectedStatus] = useState<string>(report.status);

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Update the report status.")} title={t("Status")}>
					<div className="space-y-1">
						<p className="text-sm font-medium text-fg">{t("Campaign")}</p>
						<p className="text-sm text-muted-fg">{report.campaign.year}</p>
					</div>

					<div className="space-y-1">
						<p className="text-sm font-medium text-fg">{t("Country")}</p>
						<p className="text-sm text-muted-fg">{report.country.name}</p>
					</div>

					<Select
						isRequired={true}
						onChange={(key) => {
							setSelectedStatus(String(key));
						}}
						value={selectedStatus || null}
					>
						<Label>{t("Status")}</Label>
						<SelectTrigger />
						<FieldError />
						<SelectContent>
							{reportStatusEnum.map((status) => (
								<SelectItem key={status} id={status}>
									{formatStatus(status)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<input name="status" type="hidden" value={selectedStatus} />
				</FormSection>

				<input name="id" type="hidden" value={report.id} />

				<Button className="self-start" isPending={isPending} type="submit">
					{isPending ? (
						<Fragment>
							<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
							<span aria-hidden={true}>{t("Saving...")}</span>
						</Fragment>
					) : (
						t("Save")
					)}
				</Button>

				<FormStatus className="self-start" state={state} />
			</Form>
		</FormLayout>
	);
}
